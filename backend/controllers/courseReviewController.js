const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseReview = require("../models/CourseReview");
const Enrollment = require("../models/Enrollment");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const validId = (value) => mongoose.Types.ObjectId.isValid(value);

exports.listForCourse = async (req, res) => {
  const { courseId } = req.params;
  if (!validId(courseId)) return sendError(res, "Invalid course ID.", 400);

  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true }).select("title").lean();
    if (!course) return sendError(res, "Course not found.", 404);

    const [reviews, summary, mine] = await Promise.all([
      CourseReview.find({ course: courseId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .populate("student", "name profileImage")
        .lean(),
      CourseReview.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(courseId) } },
        { $group: { _id: null, averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      ]),
      CourseReview.findOne({ course: courseId, student: req.user.id }).select("_id").lean(),
    ]);

    return res.json({
      success: true,
      course: { id: String(course._id), title: course.title },
      reviews: reviews.map((review) => ({
        id: String(review._id),
        rating: review.rating,
        comment: review.comment || "",
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        student: review.student ? {
          id: String(review.student._id),
          name: review.student.name,
          profileImage: review.student.profileImage || "",
        } : null,
      })),
      averageRating: summary[0]?.averageRating ? Math.round(summary[0].averageRating * 100) / 100 : 0,
      totalReviews: summary[0]?.totalReviews || 0,
      hasReviewed: Boolean(mine),
    });
  } catch (error) {
    console.error("Course review list error:", error.message);
    return sendError(res, "Unable to load course reviews.");
  }
};

exports.addForCourse = async (req, res) => {
  const { courseId } = req.params;
  if (!validId(courseId)) return sendError(res, "Invalid course ID.", 400);

  const rating = Number(req.body?.rating);
  const commentInput = typeof req.body?.comment === "string" ? req.body.comment : req.body?.review;
  const comment = typeof commentInput === "string" ? commentInput.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return sendError(res, "Rating must be a whole number from 1 to 5.", 400);
  if (comment.length > 1000) return sendError(res, "Review comments cannot exceed 1,000 characters.", 400);

  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true }).select("_id").lean();
    if (!course) return sendError(res, "Course not found.", 404);
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId }).select("_id").lean();
    if (!enrollment) return sendError(res, "Enroll in this course before adding a review.", 403);

    const review = await CourseReview.create({ course: courseId, student: req.user.id, rating, comment });
    return res.status(201).json({
      success: true,
      message: "Course review added.",
      review: { id: String(review._id), rating: review.rating, comment: review.comment, review: review.comment, createdAt: review.createdAt },
    });
  } catch (error) {
    if (error.code === 11000) return sendError(res, "You have already reviewed this course.", 409);
    console.error("Course review create error:", error.message);
    return sendError(res, "Unable to add your course review.", error.name === "ValidationError" ? 400 : 500);
  }
};
