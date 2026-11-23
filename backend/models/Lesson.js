const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["video", "article"], default: "video" },
    videoUrl: { type: String, default: "" },
    content: { type: String, default: "" },
    durationMin: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false }, // free preview for non-enrolled students
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", lessonSchema);