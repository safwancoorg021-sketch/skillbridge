const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const User = require("../models/User");
const mongoose = require("mongoose");
const { createTextPdf } = require("../utils/simplePdf");

async function certificateDetails(enrollment) {
  const [student, course] = await Promise.all([
    User.findById(enrollment.student).select("name").lean(),
    Course.findById(enrollment.course).select("title instructor level").lean(),
  ]);
  if (!student || !course || !enrollment.quizPassedAt) return null;
  return {
    code: enrollment.certificateCode,
    studentName: student.name,
    courseTitle: course.title,
    instructor: course.instructor || "SkillBridge Instructor",
    level: course.level || "",
    score: enrollment.quizScore || 0,
    issuedAt: enrollment.certificateIssuedAt,
  };
}

exports.listMine = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      student: req.user.id,
      certificateIssuedAt: { $ne: null },
      certificateCode: { $ne: "" },
    })
      .sort({ certificateIssuedAt: -1, _id: -1 })
      .populate("course", "title instructor level")
      .lean();
    const certificates = enrollments.filter((enrollment) => enrollment.course).map((enrollment) => ({
      certificateId: String(enrollment._id),
      code: enrollment.certificateCode,
      courseId: String(enrollment.course._id),
      courseTitle: enrollment.course.title,
      instructor: enrollment.course.instructor || "SkillBridge Instructor",
      level: enrollment.course.level || "",
      score: enrollment.quizScore || 0,
      issuedAt: enrollment.certificateIssuedAt,
      downloadUrl: `/api/certificates/${String(enrollment._id)}/download`,
    }));
    return res.json({ success: true, certificates, total: certificates.length });
  } catch (error) {
    console.error("Student certificate list error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your certificates." });
  }
};

exports.downloadCertificate = async (req, res) => {
  const certificateId = String(req.params.certificateId || "").trim();
  const lookups = [{ certificateCode: certificateId.toUpperCase() }];
  if (mongoose.Types.ObjectId.isValid(certificateId)) lookups.unshift({ _id: certificateId });
  try {
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      certificateIssuedAt: { $ne: null },
      certificateCode: { $ne: "" },
      $or: lookups,
    }).lean();
    if (!enrollment) return res.status(404).json({ success: false, message: "Certificate not found." });
    const certificate = await certificateDetails(enrollment);
    if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });
    const pdf = createTextPdf([
      "SkillBridge Certificate of Completion",
      `Presented to: ${certificate.studentName}`,
      `Course: ${certificate.courseTitle}`,
      `Instructor: ${certificate.instructor}`,
      `Level: ${certificate.level || "All levels"}`,
      `Assessment score: ${certificate.score}%`,
      `Date issued: ${new Date(certificate.issuedAt).toISOString().slice(0, 10)}`,
      `Certificate ID: ${certificate.code}`,
    ]);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="SkillBridge-Certificate-${certificate.code}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    });
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Student certificate download error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to download this certificate." });
  }
};

exports.getCertificate = async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!/^SB-[A-F0-9]{16}$/.test(code)) return res.status(404).json({ success: false, message: "Certificate not found." });
  try {
    const enrollment = await Enrollment.findOne({ certificateCode: code, student: req.user.id, certificateIssuedAt: { $ne: null } }).lean();
    if (!enrollment) return res.status(404).json({ success: false, message: "Certificate not found." });
    const certificate = await certificateDetails(enrollment);
    if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found." });
    return res.json({
      success: true,
      certificate,
    });
  } catch (error) {
    console.error("Student certificate load error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load this certificate." });
  }
};
