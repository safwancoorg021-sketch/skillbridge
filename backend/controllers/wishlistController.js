const mongoose = require("mongoose");
const Course = require("../models/Course");
const WishlistItem = require("../models/WishlistItem");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });

exports.listMine = async (req, res) => {
  try {
    const items = await WishlistItem.find({ student: req.user.id })
      .sort({ createdAt: -1, _id: -1 })
      .populate({ path: "course", match: { isPublished: true } })
      .lean();
    const courses = items.filter((item) => item.course).map((item) => ({
      id: String(item.course._id),
      title: item.course.title,
      description: item.course.description,
      thumbnail: item.course.thumbnail,
      category: item.course.category,
      level: item.course.level,
      instructor: item.course.instructor,
      price: item.course.price,
      isFree: item.course.isFree,
      addedAt: item.createdAt,
    }));
    return res.json({ success: true, courses, total: courses.length });
  } catch (error) {
    console.error("Student wishlist load error:", error.message);
    return sendError(res, "Unable to load your wishlist.");
  }
};

exports.addCourse = async (req, res) => {
  const courseId = req.params.courseId;
  if (!mongoose.Types.ObjectId.isValid(courseId)) return sendError(res, "Choose a valid course.", 400);

  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true }).select("_id title").lean();
    if (!course) return sendError(res, "This course is not available.", 404);
    const item = await WishlistItem.findOneAndUpdate(
      { student: req.user.id, course: courseId },
      { $setOnInsert: { student: req.user.id, course: courseId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ success: true, message: `${course.title} was added to your wishlist.`, courseId: String(item.course) });
  } catch (error) {
    if (error.code === 11000) return res.json({ success: true, message: "This course is already in your wishlist.", courseId });
    console.error("Student wishlist add error:", error.message);
    return sendError(res, "Unable to add this course to your wishlist.");
  }
};

exports.removeCourse = async (req, res) => {
  const courseId = req.params.courseId;
  if (!mongoose.Types.ObjectId.isValid(courseId)) return sendError(res, "Choose a valid course.", 400);
  try {
    await WishlistItem.deleteOne({ student: req.user.id, course: courseId });
    return res.json({ success: true, message: "Course removed from your wishlist." });
  } catch (error) {
    console.error("Student wishlist remove error:", error.message);
    return sendError(res, "Unable to remove this course from your wishlist.");
  }
};
