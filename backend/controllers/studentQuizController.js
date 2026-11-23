const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseQuiz = require("../models/CourseQuiz");
const Enrollment = require("../models/Enrollment");
const { issueCertificateIfComplete } = require("../utils/certificates");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });

async function getEnrolledQuiz(courseId, studentId) {
  const [course, enrollment, quiz] = await Promise.all([
    Course.findOne({ _id: courseId, isPublished: true }).select("title").lean(),
    Enrollment.findOne({ student: studentId, course: courseId }).lean(),
    CourseQuiz.findOne({ course: courseId }).lean(),
  ]);
  return { course, enrollment, quiz };
}

exports.getQuiz = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  try {
    const { course, enrollment, quiz } = await getEnrolledQuiz(req.params.courseId, req.user.id);
    if (!course) return sendError(res, "Course not found.", 404);
    if (!enrollment) return sendError(res, "Enroll in this course to take its quiz.", 403);
    if (!quiz) return sendError(res, "The course quiz is not available yet.", 404);
    return res.json({
      success: true,
      course: { id: String(req.params.courseId), title: course.title },
      quiz: {
        id: String(quiz._id),
        title: quiz.title,
        passPercentage: quiz.passPercentage,
        questions: quiz.questions.map((question) => ({ id: String(question._id), prompt: question.prompt, choices: question.choices })),
      },
      result: {
        attemptCount: enrollment.quizAttemptCount || 0,
        bestScore: enrollment.quizScore || 0,
        passed: Boolean(enrollment.quizPassedAt),
        certificateCode: enrollment.certificateCode || "",
      },
    });
  } catch (error) {
    console.error("Student quiz load error:", error.message);
    return sendError(res, "Unable to load this course quiz.");
  }
};

exports.submitQuiz = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  try {
    const { course, enrollment, quiz } = await getEnrolledQuiz(req.params.courseId, req.user.id);
    if (!course) return sendError(res, "Course not found.", 404);
    if (!enrollment) return sendError(res, "Enroll in this course to take its quiz.", 403);
    if (!quiz) return sendError(res, "The course quiz is not available yet.", 404);

    const answers = req.body?.answers;
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length || answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer > 3 || !quiz.questions[index]?.choices?.[answer])) {
      return sendError(res, "Answer every question before submitting the quiz.", 400);
    }

    const correctCount = answers.reduce((total, answer, index) => total + (answer === quiz.questions[index].correctAnswer ? 1 : 0), 0);
    const score = Math.round(correctCount / quiz.questions.length * 100);
    const passedThisAttempt = score >= quiz.passPercentage;
    const update = {
      $inc: { quizAttemptCount: 1 },
      $max: { quizScore: score },
      $set: { quizLastAttemptAt: new Date() },
    };
    if (passedThisAttempt && !enrollment.quizPassedAt) update.$set.quizPassedAt = new Date();
    const updated = await Enrollment.findOneAndUpdate(
      { _id: enrollment._id, student: req.user.id },
      update,
      { new: true }
    ).lean();
    if (!updated) return sendError(res, "Enrollment not found.", 403);

    const certificate = await issueCertificateIfComplete(updated._id);
    return res.json({
      success: true,
      message: passedThisAttempt ? "You passed the course quiz." : "You did not reach the pass mark. Review the answers and try again.",
      score,
      passPercentage: quiz.passPercentage,
      correctCount,
      totalQuestions: quiz.questions.length,
      passed: passedThisAttempt,
      quizPassed: Boolean(certificate.enrollment?.quizPassedAt || updated.quizPassedAt),
      attemptCount: certificate.enrollment?.quizAttemptCount || updated.quizAttemptCount,
      certificateCode: certificate.enrollment?.certificateCode || "",
      answerReview: quiz.questions.map((question, index) => ({ questionId: String(question._id), selectedAnswer: answers[index], correctAnswer: question.correctAnswer })),
    });
  } catch (error) {
    console.error("Student quiz submit error:", error.message);
    return sendError(res, "Unable to score this quiz.");
  }
};

exports.getResult = async (req, res) => {
  const { quizId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(quizId)) return sendError(res, "Invalid quiz ID.", 400);
  try {
    const quiz = await CourseQuiz.findById(quizId).select("_id course title passPercentage").lean();
    if (!quiz) return sendError(res, "Quiz not found.", 404);
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: quiz.course })
      .select("quizAttemptCount quizScore quizPassedAt quizLastAttemptAt certificateCode")
      .lean();
    if (!enrollment) return sendError(res, "Enroll in this course to view its quiz result.", 403);
    if (!enrollment.quizAttemptCount) return sendError(res, "No quiz result is available yet.", 404);
    return res.json({
      success: true,
      result: {
        quizId: String(quiz._id),
        courseId: String(quiz.course),
        title: quiz.title,
        score: enrollment.quizScore || 0,
        passPercentage: quiz.passPercentage,
        passed: Boolean(enrollment.quizPassedAt),
        attemptCount: enrollment.quizAttemptCount || 0,
        lastAttemptAt: enrollment.quizLastAttemptAt || null,
        passedAt: enrollment.quizPassedAt || null,
        certificateCode: enrollment.certificateCode || "",
      },
    });
  } catch (error) {
    console.error("Student quiz result error:", error.message);
    return sendError(res, "Unable to load this quiz result.");
  }
};
