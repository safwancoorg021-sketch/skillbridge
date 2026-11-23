const crypto = require("crypto");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Lesson = require("../models/Lesson");
const { notifyStudent } = require("./studentNotifications");

exports.issueCertificateIfComplete = async (enrollmentId) => {
  const enrollment = await Enrollment.findById(enrollmentId).lean();
  if (!enrollment || !enrollment.quizPassedAt) return { enrollment, issued: false };
  if (enrollment.certificateCode && enrollment.certificateIssuedAt) return { enrollment, issued: false };

  const [lessons, course] = await Promise.all([
    Lesson.find({ course: enrollment.course }).select("_id").lean(),
    Course.findById(enrollment.course).select("title").lean(),
  ]);
  const completed = new Set((enrollment.completedLessons || []).map(String));
  if (!lessons.length || lessons.some((lesson) => !completed.has(String(lesson._id))) || !course) return { enrollment, issued: false };

  const certificateCode = `SB-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const issuedAt = new Date();
  const updated = await Enrollment.findOneAndUpdate(
    { _id: enrollment._id, quizPassedAt: { $ne: null }, certificateIssuedAt: null },
    { $set: { certificateCode, certificateIssuedAt: issuedAt } },
    { new: true }
  ).lean();
  if (!updated) return { enrollment: await Enrollment.findById(enrollment._id).lean(), issued: false };

  await notifyStudent(updated.student, {
    type: "system",
    title: "Course certificate earned",
    message: `You completed ${course.title} and passed its quiz. Your certificate is ready.`,
    linkPath: `/certificate/${certificateCode}`,
    sourceKey: `certificate:${certificateCode}`,
  });
  return { enrollment: updated, issued: true };
};
