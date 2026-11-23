const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 500 },
    choices: [{ type: String, required: true, trim: true, maxlength: 200 }],
    correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  },
  { _id: true }
);

const courseQuizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120, default: "Course assessment" },
    passPercentage: { type: Number, required: true, min: 1, max: 100, default: 70 },
    questions: { type: [questionSchema], required: true, validate: [(questions) => questions.length > 0 && questions.length <= 50, "Quiz must have 1–50 questions."] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CourseQuiz", courseQuizSchema);
