const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseQuiz = require("../models/CourseQuiz");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });

function cleanQuiz(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const passPercentage = Number(body.passPercentage);
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (title.length < 3 || title.length > 120) throw Object.assign(new Error("Quiz title must be 3–120 characters."), { status: 400 });
  if (!Number.isInteger(passPercentage) || passPercentage < 1 || passPercentage > 100) throw Object.assign(new Error("Pass mark must be a whole number from 1 to 100."), { status: 400 });
  if (!questions.length || questions.length > 50) throw Object.assign(new Error("Add between 1 and 50 questions."), { status: 400 });
  const cleanedQuestions = questions.map((question, index) => {
    const prompt = typeof question?.prompt === "string" ? question.prompt.trim() : "";
    const choices = Array.isArray(question?.choices) ? question.choices.map((choice) => typeof choice === "string" ? choice.trim() : "") : [];
    const correctAnswer = question?.correctAnswer;
    if (prompt.length < 5 || prompt.length > 500) throw Object.assign(new Error(`Question ${index + 1} must be 5–500 characters.`), { status: 400 });
    if (choices.length !== 4 || choices.some((choice) => !choice || choice.length > 200)) throw Object.assign(new Error(`Question ${index + 1} needs four answers, each 1–200 characters.`), { status: 400 });
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) throw Object.assign(new Error(`Choose the correct answer for question ${index + 1}.`), { status: 400 });
    return { prompt, choices, correctAnswer };
  });
  return { title, passPercentage, questions: cleanedQuestions };
}

exports.getForCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  try {
    const [course, quiz] = await Promise.all([
      Course.findById(req.params.courseId).select("title isPublished").lean(),
      CourseQuiz.findOne({ course: req.params.courseId }).lean(),
    ]);
    if (!course) return sendError(res, "Course not found.", 404);
    return res.json({ success: true, course, quiz });
  } catch (error) {
    console.error("Admin quiz load error:", error.message);
    return sendError(res, "Unable to load this course quiz.");
  }
};

exports.saveForCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  let fields;
  try {
    fields = cleanQuiz(req.body);
  } catch (error) {
    return sendError(res, error.message, error.status || 400);
  }
  try {
    const course = await Course.findById(req.params.courseId).select("_id").lean();
    if (!course) return sendError(res, "Course not found.", 404);
    const quiz = await CourseQuiz.findOneAndUpdate(
      { course: course._id },
      { $set: { ...fields, course: course._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ success: true, message: "Course quiz saved. Students can take it after enrolling.", quiz });
  } catch (error) {
    console.error("Admin quiz save error:", error.message);
    return sendError(res, "Unable to save this course quiz.");
  }
};
