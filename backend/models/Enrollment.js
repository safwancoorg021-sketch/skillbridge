const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
    quizPassedAt: { type: Date, default: null },
    quizScore: { type: Number, default: 0, min: 0, max: 100 },
    quizAttemptCount: { type: Number, default: 0, min: 0 },
    quizLastAttemptAt: { type: Date, default: null },
    certificateCode: { type: String, default: "", trim: true },
    certificateIssuedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true }); // no double enrollment

module.exports = mongoose.model("Enrollment", enrollmentSchema);
