const crypto = require("crypto");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const PaymentOrder = require("../models/PaymentOrder");
const Coupon = require("../models/Coupon");
const User = require("../models/User");
const { notifyStudent } = require("../utils/studentNotifications");
const { createTextPdf } = require("../utils/simplePdf");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const hasRazorpayCredentials = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

async function razorpayRequest(endpoint, method, body) {
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.description || "Razorpay could not process the request.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function fulfillOrder(order) {
  for (const item of order.items) {
    try {
      const result = await Enrollment.updateOne(
        { student: order.student, course: item.course },
        { $setOnInsert: { student: order.student, course: item.course } },
        { upsert: true }
      );
      if (result.upsertedCount) {
        await Course.updateOne({ _id: item.course }, { $inc: { enrollmentCount: 1 } });
      }
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const courseIds = order.items.map((item) => item.course);
  await Cart.updateOne(
    { student: order.student },
    { $pull: { items: { course: { $in: courseIds } } } }
  );
}

async function calculateCouponDiscount(code, subtotalPaise) {
  if (!code) return { coupon: null, discountPaise: 0 };
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase(), isActive: true }).lean();
  const now = new Date();
  if (!coupon || coupon.startsAt > now || coupon.endsAt < now) throw Object.assign(new Error("This coupon is invalid, inactive, or expired."), { status: 400 });
  if (subtotalPaise < Math.round(Number(coupon.minOrderAmount || 0) * 100)) throw Object.assign(new Error(`This coupon needs a minimum cart value of ₹${Number(coupon.minOrderAmount).toLocaleString("en-IN")}.`), { status: 400 });
  let discountPaise = coupon.discountType === "percentage"
    ? Math.round(subtotalPaise * Number(coupon.discountValue) / 100)
    : Math.round(Number(coupon.discountValue) * 100);
  if (coupon.discountType === "percentage" && Number(coupon.maxDiscountAmount) > 0) discountPaise = Math.min(discountPaise, Math.round(Number(coupon.maxDiscountAmount) * 100));
  discountPaise = Math.max(0, Math.min(subtotalPaise, discountPaise));
  return { coupon, discountPaise };
}

async function completeOrder(order, paymentId = "") {
  await fulfillOrder(order);
  const result = await PaymentOrder.updateOne(
    { _id: order._id, status: "pending" },
    { $set: { status: "paid", paymentId, paidAt: new Date() } }
  );
  if (result.modifiedCount) {
    if (order.couponId) await Coupon.updateOne({ _id: order.couponId }, { $inc: { usageCount: 1 } });
    const courseNames = order.items.map((item) => item.title).filter(Boolean);
    await notifyStudent(order.student, {
      type: "enrollment",
      title: "Enrollment confirmed",
      message: `Your course${courseNames.length === 1 ? " is" : "s are"} ready${courseNames.length ? `: ${courseNames.join(", ")}` : ""}.`,
      linkPath: "/my-courses",
    });
  }
}

exports.previewOrder = async (req, res) => {
  const couponCode = typeof req.body?.couponCode === "string"
    ? req.body.couponCode.trim().toUpperCase()
    : typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  try {
    const cart = await Cart.findOne({ student: req.user.id }).lean();
    const cartCourseIds = (cart?.items || []).map((item) => item.course);
    const [courses, existingEnrollments] = cartCourseIds.length
      ? await Promise.all([
        Course.find({ _id: { $in: cartCourseIds }, isPublished: true }).lean(),
        Enrollment.find({ student: req.user.id, course: { $in: cartCourseIds } }).select("course").lean(),
      ])
      : [[], []];
    const enrolledIds = new Set(existingEnrollments.map((item) => String(item.course)));
    const courseById = new Map(courses.map((course) => [String(course._id), course]));
    const items = cartCourseIds
      .map((id) => courseById.get(String(id)))
      .filter((course) => course && !enrolledIds.has(String(course._id)))
      .map((course) => ({
        courseId: String(course._id),
        title: course.title,
        amountPaise: Math.round((course.isFree ? 0 : Number(course.price) || 0) * 100),
      }));
    const subtotalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);
    if (couponCode && subtotalPaise <= 0) return sendError(res, "Coupons apply to paid courses in your cart.", 400);
    const { coupon, discountPaise } = await calculateCouponDiscount(couponCode, subtotalPaise);
    return res.json({
      success: true,
      items,
      subtotalPaise,
      discountPaise,
      totalPaise: Math.max(0, subtotalPaise - discountPaise),
      couponCode: coupon?.code || "",
    });
  } catch (error) {
    return sendError(res, error.message || "Unable to preview this order.", error.status || 500);
  }
};

exports.listMine = async (req, res) => {
  const pageValue = Number.parseInt(req.query.page, 10);
  const limitValue = Number.parseInt(req.query.limit, 10);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : 20;
  try {
    const [total, orders] = await Promise.all([
      PaymentOrder.countDocuments({ student: req.user.id }),
      PaymentOrder.find({ student: req.user.id })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    return res.json({
      success: true,
      payments: orders.map((order) => ({
        id: String(order._id),
        orderId: order.providerOrderId || "",
        paymentId: order.paymentId || "",
        items: order.items.map((item) => ({ courseId: String(item.course), title: item.title, amountPaise: item.amountPaise })),
        subtotalPaise: order.subtotalPaise,
        discountPaise: order.discountPaise,
        amountPaise: order.amountPaise,
        currency: order.currency,
        status: order.status,
        couponCode: order.couponCode || "",
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        refundRequest: {
          status: order.refundRequestStatus || "none",
          requestedAt: order.refundRequestedAt || null,
          reason: order.refundReason || "",
        },
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Student payment history error:", error.message);
    return sendError(res, "Unable to load your payment history.");
  }
};

async function findOwnPayment(paymentId, studentId) {
  const lookups = [{ paymentId, student: studentId }, { providerOrderId: paymentId, student: studentId }];
  if (mongoose.Types.ObjectId.isValid(paymentId)) lookups.unshift({ _id: paymentId, student: studentId });
  return PaymentOrder.findOne({ $or: lookups });
}

exports.downloadInvoice = async (req, res) => {
  try {
    const order = await findOwnPayment(req.params.paymentId, req.user.id);
    if (!order || order.status !== "paid") return sendError(res, "Paid invoice not found.", 404);
    const student = await User.findById(req.user.id).select("name email").lean();
    const lines = [
      "SkillBridge payment invoice",
      `Invoice ID: SB-${String(order._id).toUpperCase()}`,
      `Issued: ${new Date(order.paidAt || order.createdAt).toISOString().slice(0, 10)}`,
      `Student: ${student?.name || "Student"}`,
      `Email: ${student?.email || ""}`,
      `Order: ${order.providerOrderId || String(order._id)}`,
      "",
      "Purchased courses:",
      ...order.items.map((item) => `${item.title} - INR ${(item.amountPaise / 100).toFixed(2)}`),
      `Subtotal: INR ${(order.subtotalPaise / 100).toFixed(2)}`,
      `Discount: INR ${(order.discountPaise / 100).toFixed(2)}`,
      `Total paid: INR ${(order.amountPaise / 100).toFixed(2)}`,
      `Payment ID: ${order.paymentId || "Not provided"}`,
      `Coupon: ${order.couponCode || "None"}`,
    ];
    const pdf = createTextPdf(lines);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="SkillBridge-Invoice-${String(order._id)}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    });
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Student invoice download error:", error.message);
    return sendError(res, "Unable to download this invoice.");
  }
};

exports.requestRefund = async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (reason.length > 500) return sendError(res, "Refund reason cannot exceed 500 characters.", 400);
  try {
    const order = await findOwnPayment(req.params.paymentId, req.user.id);
    if (!order) return sendError(res, "Payment not found.", 404);
    if (order.status !== "paid" || order.provider !== "razorpay" || !order.paymentId) {
      return sendError(res, "Only a completed Razorpay payment can be submitted for refund review.", 409);
    }
    if (order.refundRequestStatus === "requested") {
      return res.json({ success: true, message: "Your refund request is already awaiting review.", refundRequest: { status: "requested", requestedAt: order.refundRequestedAt, reason: order.refundReason || "" } });
    }
    order.refundRequestStatus = "requested";
    order.refundRequestedAt = new Date();
    order.refundReason = reason;
    await order.save();
    return res.status(202).json({
      success: true,
      message: "Your refund request was submitted for review.",
      refundRequest: { status: order.refundRequestStatus, requestedAt: order.refundRequestedAt, reason: order.refundReason },
    });
  } catch (error) {
    console.error("Student refund request error:", error.message);
    return sendError(res, "Unable to submit your refund request.");
  }
};

exports.validateCoupon = async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) return sendError(res, "Enter a valid coupon code.", 400);
  try {
    const cart = await Cart.findOne({ student: req.user.id }).lean();
    const courseIds = (cart?.items || []).map((item) => item.course);
    if (!courseIds.length) return sendError(res, "Add a course to your cart before applying a coupon.", 400);
    const [courses, enrollments] = await Promise.all([
      Course.find({ _id: { $in: courseIds }, isPublished: true }).lean(),
      Enrollment.find({ student: req.user.id, course: { $in: courseIds } }).select("course").lean(),
    ]);
    const enrolledIds = new Set(enrollments.map((item) => String(item.course)));
    const purchasable = courses.filter((course) => !enrolledIds.has(String(course._id)));
    const subtotalPaise = purchasable.reduce((sum, course) => sum + Math.round((course.isFree ? 0 : Number(course.price) || 0) * 100), 0);
    if (!subtotalPaise) return sendError(res, "Coupons apply to paid courses in your cart.", 400);
    const { coupon, discountPaise } = await calculateCouponDiscount(code, subtotalPaise);
    return res.json({ success: true, message: "Coupon applied.", coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue }, subtotalPaise, discountPaise, totalPaise: subtotalPaise - discountPaise });
  } catch (error) {
    return sendError(res, error.message || "Unable to validate this coupon.", error.status || 500);
  }
};

exports.createOrder = async (req, res) => {
  try {
    const cart = await Cart.findOne({ student: req.user.id }).lean();
    const cartCourseIds = (cart?.items || []).map((item) => item.course);
    if (!cartCourseIds.length) return sendError(res, "Your cart is empty.", 400);

    const [courses, existingEnrollments] = await Promise.all([
      Course.find({ _id: { $in: cartCourseIds }, isPublished: true }).lean(),
      Enrollment.find({ student: req.user.id, course: { $in: cartCourseIds } }).select("course").lean(),
    ]);
    const enrolledIds = new Set(existingEnrollments.map((item) => String(item.course)));
    const courseById = new Map(courses.map((course) => [String(course._id), course]));
    const purchasableCourses = cartCourseIds
      .map((id) => courseById.get(String(id)))
      .filter((course) => course && !enrolledIds.has(String(course._id)));
    if (!purchasableCourses.length) return sendError(res, "Your cart has no available courses to purchase.", 400);

    const items = purchasableCourses.map((course) => ({
      course: course._id,
      title: course.title,
      amountPaise: Math.round((course.isFree ? 0 : Number(course.price) || 0) * 100),
    }));
    const subtotalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);
    if (subtotalPaise > 100_000_000) return sendError(res, "Your cart total is above the checkout limit.", 400);
    const couponCode = typeof req.body?.couponCode === "string" ? req.body.couponCode.trim().toUpperCase() : "";
    const { coupon, discountPaise } = await calculateCouponDiscount(couponCode, subtotalPaise);
    const amountPaise = subtotalPaise - discountPaise;

    if (amountPaise === 0) {
      const freeOrder = await PaymentOrder.create({
        student: req.user.id,
        items,
        amountPaise,
        subtotalPaise,
        discountPaise,
        couponId: coupon?._id || null,
        couponCode: coupon?.code || "",
        provider: "free",
        status: "pending",
      });
      await completeOrder(freeOrder);
      return res.json({ success: true, free: true, message: "You are enrolled in your free course(s)." });
    }

    if (!hasRazorpayCredentials()) {
      return sendError(res, "Checkout is not configured yet. Add Razorpay test keys to backend/.env.", 503);
    }

    const order = await PaymentOrder.create({
      student: req.user.id,
      items,
      amountPaise,
      subtotalPaise,
      discountPaise,
      couponId: coupon?._id || null,
      couponCode: coupon?.code || "",
      currency: "INR",
      provider: "razorpay",
      status: "pending",
    });

    try {
      const razorpayOrder = await razorpayRequest("/orders", "POST", {
        amount: amountPaise,
        currency: "INR",
        receipt: `sb_${order._id}`,
        notes: { purchaseOrderId: String(order._id) },
      });
      order.providerOrderId = razorpayOrder.id;
      await order.save();

      return res.status(201).json({
        success: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        courseNames: items.map((item) => item.title),
        subtotalPaise,
        discountPaise,
        couponCode: coupon?.code || "",
      });
    } catch (error) {
      order.status = "failed";
      await order.save();
      console.error("Create Razorpay order error:", error.message);
      return sendError(res, "Unable to start checkout. Please try again.", 502);
    }
  } catch (error) {
    console.error("Create checkout order error:", error.message);
    return sendError(
      res,
      error.status === 400 ? error.message : "Unable to start checkout right now.",
      error.status || 500
    );
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id: providerOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (
    typeof providerOrderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) return sendError(res, "Payment confirmation is invalid.", 400);
  if (!hasRazorpayCredentials()) return sendError(res, "Checkout is not configured.", 503);

  try {
    const order = await PaymentOrder.findOne({ providerOrderId, student: req.user.id });
    if (!order) return sendError(res, "This checkout order was not found.", 404);
    if (order.status === "paid") {
      return res.json({ success: true, message: "Payment already confirmed. Your courses are ready." });
    }
    if (order.status !== "pending") return sendError(res, "This checkout is no longer active.", 409);

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${order.providerOrderId}|${paymentId}`)
      .digest();
    const receivedSignature = Buffer.from(signature, "hex");
    if (expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
      return sendError(res, "Payment confirmation could not be verified.", 400);
    }

    let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, "GET");
    if (
      payment.order_id !== order.providerOrderId ||
      Number(payment.amount) !== order.amountPaise ||
      payment.currency !== order.currency
    ) return sendError(res, "The payment details do not match this order.", 400);

    if (payment.status === "authorized") {
      payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, "POST", {
        amount: order.amountPaise,
        currency: order.currency,
      });
    }
    if (payment.status !== "captured") {
      return sendError(res, "Payment has not been captured yet. Please check the payment status and try again.", 409);
    }

    await completeOrder(order, paymentId);
    return res.json({ success: true, message: "Payment confirmed. Your courses are ready." });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error.message);
    return sendError(res, "Unable to confirm payment right now. If money was deducted, contact support before trying again.", 502);
  }
};

exports.handleWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get("x-razorpay-signature");
  if (!webhookSecret || !Buffer.isBuffer(req.body) || typeof signature !== "string") {
    return res.status(400).send("Webhook verification is not configured.");
  }

  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest();
  let receivedSignature;
  try {
    receivedSignature = Buffer.from(signature, "hex");
  } catch {
    return res.status(400).send("Invalid webhook signature.");
  }
  if (expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
    return res.status(400).send("Invalid webhook signature.");
  }

  try {
    const payload = JSON.parse(req.body.toString("utf8"));
    const payment = payload.payload?.payment?.entity;
    if (payload.event !== "payment.captured" || !payment?.order_id) return res.json({ received: true });

    const order = await PaymentOrder.findOne({ providerOrderId: payment.order_id });
    if (!order || order.status === "paid") return res.json({ received: true });
    if (Number(payment.amount) !== order.amountPaise || payment.currency !== order.currency) {
      console.error("Razorpay webhook payment amount mismatch for an order.");
      return res.status(400).send("Payment details do not match the order.");
    }

    await completeOrder(order, payment.id || "");
    return res.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook processing error:", error.message);
    return res.status(500).send("Unable to process payment event.");
  }
};
