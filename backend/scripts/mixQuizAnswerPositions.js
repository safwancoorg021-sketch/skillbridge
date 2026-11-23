require("dotenv").config();
const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseQuiz = require("../models/CourseQuiz");

const answerPositions = [2, 0, 3, 1, 2, 3, 0, 1, 3, 2];

async function mixQuizAnswerPositions() {
  await mongoose.connect(process.env.MONGODB_URI);
  const quizzes = await CourseQuiz.find({});
  let updated = 0;

  for (const quiz of quizzes) {
    quiz.questions.forEach((question, index) => {
      const correctChoice = question.choices[question.correctAnswer];
      const choices = question.choices.filter((_, choiceIndex) => choiceIndex !== question.correctAnswer);
      const newCorrectAnswer = answerPositions[index % answerPositions.length];
      choices.splice(newCorrectAnswer, 0, correctChoice);
      question.choices = choices;
      question.correctAnswer = newCorrectAnswer;
    });
    await quiz.save();

    const course = await Course.findById(quiz.course).select("title").lean();
    const distribution = [0, 0, 0, 0];
    quiz.questions.forEach((question) => { distribution[question.correctAnswer] += 1; });
    console.log(`${course?.title || "Course"}: ${quiz.questions.length} answers mixed (A:${distribution[0]} B:${distribution[1]} C:${distribution[2]} D:${distribution[3]}).`);
    updated += 1;
  }

  console.log(`Updated ${updated} course quiz(es); correct answers remain aligned with the answer key.`);
}

mixQuizAnswerPositions()
  .catch((error) => {
    console.error("Unable to mix quiz answer positions:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
