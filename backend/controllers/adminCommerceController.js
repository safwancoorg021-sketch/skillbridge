const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const Offer = require("../models/Offer");
const PaymentOrder = require("../models/PaymentOrder");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const User = require("../models/User");
const { notifyAllStudents } = require("../utils/studentNotifications");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const isDate = (value) => value && Number.isFinite(new Date(value).getTime());
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanCoupon(body = {}) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const minOrderAmount = Number(body.minOrderAmount || 0);
  const maxDiscountAmount = Number(body.maxDiscountAmount || 0);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw Object.assign(new Error("Coupon code must be 3–32 letters or numbers."), { status: 400 });
  if (!["percentage", "fixed"].includes(discountType)) throw Object.assign(new Error("Choose percentage or fixed discount."), { status: 400 });
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) throw Object.assign(new Error("Enter a valid discount value."), { status: 400 });
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0 || !Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0) throw Object.assign(new Error("Enter valid order and discount limits."), { status: 400 });
  if (!isDate(body.endsAt)) throw Object.assign(new Error("Choose a valid coupon expiry date."), { status: 400 });
  const startsAt = body.startsAt && isDate(body.startsAt) ? new Date(body.startsAt) : new Date();
  const endsAt = new Date(body.endsAt);
  if (endsAt <= startsAt) throw Object.assign(new Error("Coupon expiry must be after its start date."), { status: 400 });
  return { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, startsAt, endsAt, isActive: body.isActive !== false };
}

function cleanOffer(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const discountLabel = typeof body.discountLabel === "string" ? body.discountLabel.trim() : "";
  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
  if (title.length < 3 || title.length > 100) throw Object.assign(new Error("Offer title must be 3–100 characters."), { status: 400 });
  if (!description || description.length > 500) throw Object.assign(new Error("Enter an offer description up to 500 characters."), { status: 400 });
  if (!discountLabel || discountLabel.length > 50) throw Object.assign(new Error("Enter a short discount label, such as 20% off."), { status: 400 });
  if (couponCode && !/^[A-Z0-9_-]{3,32}$/.test(couponCode)) throw Object.assign(new Error("Enter a valid coupon code or leave it blank."), { status: 400 });
  if (!isDate(body.endsAt)) throw Object.assign(new Error("Choose a valid offer expiry date."), { status: 400 });
  const startsAt = body.startsAt && isDate(body.startsAt) ? new Date(body.startsAt) : new Date();
  const endsAt = new Date(body.endsAt);
  if (endsAt <= startsAt) throw Object.assign(new Error("Offer expiry must be after its start date."), { status: 400 });
  return { title, description, discountLabel, couponCode, startsAt, endsAt, isActive: body.isActive !== false };
}

exports.listCoupons = async (_req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1, _id: -1 }).lean();
    return res.json({ success: true, coupons });
  } catch (error) {
    console.error("Admin coupon listing error:", error.message);
    return sendError(res, "Unable to load coupons.");
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(cleanCoupon(req.body));
    return res.status(201).json({ success: true, message: "Coupon created.", coupon });
  } catch (error) {
    return sendError(res, error.code === 11000 ? "That coupon code already exists." : error.message || "Unable to create coupon.", error.status || (error.name === "ValidationError" || error.code === 11000 ? 400 : 500));
  }
};

exports.updateCoupon = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid coupon ID.", 400);
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return sendError(res, "Coupon not found.", 404);
    Object.assign(coupon, cleanCoupon(req.body));
    await coupon.save();
    return res.json({ success: true, message: "Coupon updated.", coupon });
  } catch (error) {
    return sendError(res, error.code === 11000 ? "That coupon code already exists." : error.message || "Unable to update coupon.", error.status || (error.name === "ValidationError" || error.code === 11000 ? 400 : 500));
  }
};

exports.deleteCoupon = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid coupon ID.", 400);
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return sendError(res, "Coupon not found.", 404);
    await Offer.updateMany({ couponCode: coupon.code }, { $set: { couponCode: "" } });
    return res.json({ success: true, message: "Coupon deleted." });
  } catch (error) {
    return sendError(res, "Unable to delete coupon.");
  }
};

exports.listOffers = async (_req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1, _id: -1 }).lean();
    return res.json({ success: true, offers });
  } catch (error) {
    console.error("Admin offer listing error:", error.message);
    return sendError(res, "Unable to load offers.");
  }
};

exports.createOffer = async (req, res) => {
  try {
    const fields = cleanOffer(req.body);
    if (fields.couponCode && !(await Coupon.exists({ code: fields.couponCode }))) return sendError(res, "Choose an existing coupon or leave the coupon field empty.", 400);
    const offer = await Offer.create(fields);
    const now = new Date();
    if (offer.isActive && offer.startsAt <= now && offer.endsAt >= now) {
      await notifyAllStudents({
        type: "offer",
        title: "New student offer",
        message: `${offer.discountLabel}: ${offer.title}${offer.couponCode ? ` · Code ${offer.couponCode}` : ""}`,
        linkPath: "/offers",
        sourceKey: `offer:${offer._id}`,
      });
    }
    return res.status(201).json({ success: true, message: "Offer created.", offer });
  } catch (error) {
    return sendError(res, error.message || "Unable to create offer.", error.status || (error.name === "ValidationError" ? 400 : 500));
  }
};

exports.updateOffer = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid offer ID.", 400);
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return sendError(res, "Offer not found.", 404);
    const now = new Date();
    const wasAvailable = offer.isActive && offer.startsAt <= now && offer.endsAt >= now;
    const fields = cleanOffer(req.body);
    if (fields.couponCode && !(await Coupon.exists({ code: fields.couponCode }))) return sendError(res, "Choose an existing coupon or leave the coupon field empty.", 400);
    Object.assign(offer, fields);
    await offer.save();
    const isAvailable = offer.isActive && offer.startsAt <= now && offer.endsAt >= now;
    if (isAvailable && !wasAvailable) {
      await notifyAllStudents({
        type: "offer",
        title: "New student offer",
        message: `${offer.discountLabel}: ${offer.title}${offer.couponCode ? ` · Code ${offer.couponCode}` : ""}`,
        linkPath: "/offers",
        sourceKey: `offer:${offer._id}`,
      });
    }
    return res.json({ success: true, message: "Offer updated.", offer });
  } catch (error) {
    return sendError(res, error.message || "Unable to update offer.", error.status || (error.name === "ValidationError" ? 400 : 500));
  }
};

exports.deleteOffer = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid offer ID.", 400);
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return sendError(res, "Offer not found.", 404);
    return res.json({ success: true, message: "Offer deleted." });
  } catch (error) {
    return sendError(res, "Unable to delete offer.");
  }
};

exports.listPayments = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const status = ["pending", "paid", "failed"].includes(req.query.status) ? req.query.status : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const userPattern = new RegExp(escapeRegex(search), "i");
      const users = await User.find({ role: "student", $or: [{ name: userPattern }, { email: userPattern }] }).select("_id").lean();
      filter.$or = [{ providerOrderId: userPattern }, { paymentId: userPattern }, { couponCode: userPattern }, { student: { $in: users.map((user) => user._id) } }];
    }
    const [total, payments] = await Promise.all([
      PaymentOrder.countDocuments(filter),
      PaymentOrder.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate("student", "name email").lean(),
    ]);
    return res.json({ success: true, payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Admin payment list error:", error.message);
    return sendError(res, "Unable to load payment records.");
  }
};

exports.getReports = async (_req, res) => {
  try {
    const [students, publishedCourses, totalCourses, enrollments, totals, monthlyRevenue, recentPayments] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Course.countDocuments({ isPublished: true }),
      Course.countDocuments(),
      Enrollment.countDocuments(),
      PaymentOrder.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, revenuePaise: { $sum: "$amountPaise" }, paidOrders: { $sum: 1 } } }]),
      PaymentOrder.aggregate([
        { $match: { status: "paid", paidAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } } },
        { $group: { _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } }, revenuePaise: { $sum: "$amountPaise" }, orders: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      PaymentOrder.find({ status: "paid" }).sort({ paidAt: -1 }).limit(6).populate("student", "name email").lean(),
    ]);
    return res.json({
      success: true,
      report: {
        students,
        publishedCourses,
        totalCourses,
        enrollments,
        revenuePaise: totals[0]?.revenuePaise || 0,
        paidOrders: totals[0]?.paidOrders || 0,
        monthlyRevenue,
        recentPayments,
      },
    });
  } catch (error) {
    console.error("Admin report load error:", error.message);
    return sendError(res, "Unable to load reports and analytics.");
  }
};

exports.listStudentOffers = async (_req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({ isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } }).sort({ endsAt: 1 }).lean();
    const referencedCodes = offers.map((offer) => offer.couponCode).filter(Boolean);
    const validCoupons = referencedCodes.length
      ? await Coupon.find({ code: { $in: referencedCodes }, isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } }).select("code").lean()
      : [];
    const validCodes = new Set(validCoupons.map((coupon) => coupon.code));
    const currentOffers = offers.filter((offer) => !offer.couponCode || validCodes.has(offer.couponCode));
    return res.json({ success: true, offers: currentOffers });
  } catch (error) {
    console.error("Student offer list error:", error.message);
    return sendError(res, "Unable to load current offers.");
  }
};
