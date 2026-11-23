const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const validId = (value) => mongoose.Types.ObjectId.isValid(value);

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ student: req.user.id }).populate("items.course").lean();
    const cartItems = cart?.items || [];
    const courseIds = cartItems.map((item) => item.course?._id).filter(Boolean);
    const enrollments = courseIds.length
      ? await Enrollment.find({ student: req.user.id, course: { $in: courseIds } }).select("course").lean()
      : [];
    const enrolledIds = new Set(enrollments.map((item) => String(item.course)));
    const items = cartItems
      .filter((item) => item.course?.isPublished && !enrolledIds.has(String(item.course._id)))
      .map((item) => ({
        id: String(item.course._id),
        title: item.course.title,
        description: item.course.description,
        thumbnail: item.course.thumbnail,
        category: item.course.category,
        level: item.course.level,
        instructor: item.course.instructor,
        price: item.course.price,
        isFree: item.course.isFree,
      }));

    return res.json({
      success: true,
      items,
      total: items.reduce((sum, item) => sum + (item.isFree ? 0 : Number(item.price) || 0), 0),
    });
  } catch (error) {
    console.error("Load student cart error:", error.message);
    return sendError(res, "Unable to load your cart.");
  }
};

exports.addItem = async (req, res) => {
  const { courseId } = req.body || {};
  if (typeof courseId !== "string" || !validId(courseId)) return sendError(res, "Choose a valid course.", 400);

  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true }).select("_id title").lean();
    if (!course) return sendError(res, "This course is not available.", 404);

    const enrollment = await Enrollment.findOne({ student: req.user.id, course: course._id }).select("_id").lean();
    if (enrollment) return sendError(res, "You already own this course.", 409);

    let cart = await Cart.findOne({ student: req.user.id });
    if (!cart) cart = new Cart({ student: req.user.id, items: [] });
    if (cart.items.some((item) => String(item.course) === String(course._id))) {
      return res.json({ success: true, message: "This course is already in your cart." });
    }
    if (cart.items.length >= 20) return sendError(res, "Your cart can contain up to 20 courses.", 400);

    cart.items.push({ course: course._id });
    await cart.save();
    return res.status(201).json({ success: true, message: `${course.title} was added to your cart.` });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, "Your cart is being updated. Please try again.", 409);
    }
    console.error("Add course to cart error:", error.message);
    return sendError(res, "Unable to add this course to your cart.");
  }
};

exports.removeItem = async (req, res) => {
  if (!validId(req.params.courseId)) return sendError(res, "Choose a valid course.", 400);
  try {
    await Cart.updateOne(
      { student: req.user.id },
      { $pull: { items: { course: new mongoose.Types.ObjectId(req.params.courseId) } } }
    );
    return res.json({ success: true, message: "Course removed from your cart." });
  } catch (error) {
    console.error("Remove course from cart error:", error.message);
    return sendError(res, "Unable to remove this course from your cart.");
  }
};
