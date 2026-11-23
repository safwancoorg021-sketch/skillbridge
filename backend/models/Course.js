const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    thumbnail: { type: String, default: "" }, // uploaded image path
    category: { type: String, default: "General" },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    price: { type: Number, default: 0, min: 0 },
    isFree: { type: Boolean, default: false },
    discountPrice: { type: Number, default: 0 },
    instructor: { type: String, default: "" },
    requirements: [{ type: String }],
    enrollmentCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
