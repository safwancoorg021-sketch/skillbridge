const mongoose = require("mongoose");

const courseReviewSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

courseReviewSchema.index({ course: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("CourseReview", courseReviewSchema);
