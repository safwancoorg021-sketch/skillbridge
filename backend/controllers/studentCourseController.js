const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const CourseQuiz = require("../models/CourseQuiz");
const { issueVideoAccess } = require("./courseVideoController");
const { notifyStudent } = require("../utils/studentNotifications");
const { issueCertificateIfComplete } = require("../utils/certificates");
const { getCloudinaryVideoId } = require("../config/cloudinary");

const invalidId = (id) => !mongoose.Types.ObjectId.isValid(id);

exports.listCourses = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(40, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const filter = { isPublished: true };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
        { instructor: { $regex: escaped, $options: "i" } },
      ];
    }
    if (typeof req.query.category === "string" && req.query.category.trim()) filter.category = req.query.category.trim();
    if (["Beginner", "Intermediate", "Advanced"].includes(req.query.level)) filter.level = req.query.level;

    const [courses, total, enrolled] = await Promise.all([
      Course.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Course.countDocuments(filter),
      Enrollment.find({ student: req.user.id }).select("course").lean(),
    ]);
    const enrolledIds = new Set(enrolled.map((entry) => String(entry.course)));
    const counts = await Lesson.aggregate([
      { $match: { course: { $in: courses.map((course) => course._id) } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]);
    const lessonCounts = new Map(counts.map((entry) => [String(entry._id), entry.count]));
    return res.json({
      success: true,
      courses: courses.map((course) => ({ ...course, id: String(course._id), lessonCount: lessonCounts.get(String(course._id)) || 0, isEnrolled: enrolledIds.has(String(course._id)) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Student course listing error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load available courses." });
  }
};

exports.getCourse = async (req, res) => {
  if (invalidId(req.params.courseId)) return res.status(400).json({ success: false, message: "Invalid course ID." });
  try {
    const course = await Course.findOne({ _id: req.params.courseId, isPublished: true }).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });
    const [modules, lessons, enrollment, quiz] = await Promise.all([
      CourseModule.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
      Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).select("title type durationMin order module isPreview").lean(),
      Enrollment.findOne({ student: req.user.id, course: course._id }).select("_id completedLessons quizPassedAt quizScore quizAttemptCount certificateCode certificateIssuedAt").lean(),
      CourseQuiz.exists({ course: course._id }),
    ]);
    const completed = new Set((enrollment?.completedLessons || []).map(String));
    const curriculum = modules.map((module) => ({
      id: String(module._id),
      title: module.title,
      order: module.order,
      lessons: lessons.filter((lesson) => String(lesson.module) === String(module._id)).map((lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        type: lesson.type,
        durationMin: lesson.durationMin,
        isPreview: lesson.isPreview,
        isCompleted: completed.has(String(lesson._id)),
      })),
    }));
    return res.json({ success: true, course: { ...course, id: String(course._id) }, modules: curriculum, isEnrolled: Boolean(enrollment), quizAvailable: Boolean(quiz), enrollment: enrollment ? { quizPassedAt: enrollment.quizPassedAt, quizScore: enrollment.quizScore || 0, quizAttemptCount: enrollment.quizAttemptCount || 0, certificateCode: enrollment.certificateCode || "", certificateIssuedAt: enrollment.certificateIssuedAt } : null });
  } catch (error) {
    console.error("Student course detail error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load this course." });
  }
};

exports.listCourseLessons = async (req, res) => {
  const { courseId } = req.params;
  if (invalidId(courseId)) return res.status(400).json({ success: false, message: "Invalid course ID." });
  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true }).select("title").lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId }).select("completedLessons").lean();
    const completed = new Set((enrollment?.completedLessons || []).map(String));
    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1, createdAt: 1 })
      .select("title type durationMin order module isPreview")
      .lean();
    return res.json({
      success: true,
      course: { id: String(course._id), title: course.title },
      lessons: lessons.map((lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        type: lesson.type,
        durationMin: lesson.durationMin,
        order: lesson.order,
        moduleId: lesson.module ? String(lesson.module) : "",
        isPreview: Boolean(lesson.isPreview),
        isCompleted: completed.has(String(lesson._id)),
      })),
      isEnrolled: Boolean(enrollment),
    });
  } catch (error) {
    console.error("Course lesson list error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load course lessons." });
  }
};

exports.enroll = async (req, res) => {
  const courseId = req.params.courseId || req.body?.courseId || req.query?.courseId;
  if (invalidId(courseId)) return res.status(400).json({ success: false, message: "Invalid course ID." });
  try {
    const course = await Course.findOne({ _id: courseId, isPublished: true });
    if (!course) return res.status(404).json({ success: false, message: "Course not found or not available." });
    const existing = await Enrollment.findOne({ student: req.user.id, course: course._id }).select("_id").lean();
    if (existing) return res.json({ success: true, message: "You are already enrolled. Continue learning.", enrollment: { id: String(existing._id), courseId: String(course._id) } });
    if (!course.isFree && Number(course.price) > 0) {
      return res.status(402).json({ success: false, message: "Add this course to your cart and complete checkout to enroll." });
    }
    const enrollment = await Enrollment.create({ student: req.user.id, course: course._id });
    await Course.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
    await notifyStudent(req.user.id, {
      type: "enrollment",
      title: "Enrollment confirmed",
      message: `You are enrolled in ${course.title}. Start learning whenever you are ready.`,
      linkPath: "/my-courses",
    });
    return res.status(200).json({ success: true, message: "You are enrolled. Start learning now.", enrollment: { id: String(enrollment._id), courseId: String(course._id) } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "You are already enrolled in this course." });
    console.error("Course enrollment error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to enroll in this course." });
  }
};

exports.listEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: "course", match: { isPublished: true } })
      .lean();
    const valid = enrollments.filter((item) => item.course);
    const courseIds = valid.map((item) => item.course._id);
    const [counts, quizzes] = await Promise.all([Lesson.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]), CourseQuiz.find({ course: { $in: courseIds } }).select("course").lean()]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
    const quizCourseIds = new Set(quizzes.map((item) => String(item.course)));
    return res.json({
      success: true,
      enrollments: valid.map((item) => ({
        id: String(item._id),
        enrolledAt: item.createdAt,
        completedLessons: (item.completedLessons || []).map(String),
        quizPassedAt: item.quizPassedAt || null,
        quizScore: item.quizScore || 0,
        quizAttemptCount: item.quizAttemptCount || 0,
        certificateCode: item.certificateCode || "",
        certificateIssuedAt: item.certificateIssuedAt || null,
        course: { ...item.course, id: String(item.course._id), lessonCount: countMap.get(String(item.course._id)) || 0, quizAvailable: quizCourseIds.has(String(item.course._id)) },
      })),
    });
  } catch (error) {
    console.error("Student enrollment listing error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your courses." });
  }
};

exports.getLesson = async (req, res) => {
  if (invalidId(req.params.lessonId)) return res.status(400).json({ success: false, message: "Invalid lesson ID." });
  try {
    const lesson = await Lesson.findById(req.params.lessonId).lean();
    if (!lesson) return res.status(404).json({ success: false, message: "Lesson not found." });
    const course = await Course.findOne({ _id: lesson.course, isPublished: true }).select("title").lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });
    const enrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course }).select("_id completedLessons").lean();
    if (!enrollment && !lesson.isPreview) return res.status(403).json({ success: false, message: "Enroll in this course to access this lesson." });
    if (lesson.type === "video") {
      const localVideoMatch = /^\/uploads\/course-videos\/([a-f0-9-]{36})\.mp4$/i.exec(lesson.videoUrl || "");
      const cloudinaryVideoId = getCloudinaryVideoId(lesson.videoUrl);
      const videoId = localVideoMatch?.[1] || cloudinaryVideoId;
      if (!videoId) return res.status(409).json({ success: false, message: "This lesson needs an uploaded SkillBridge video. Ask the course admin to upload it." });
      issueVideoAccess(res, req.user.id, lesson._id);
      lesson.videoUrl = `/api/lessons/videos/${videoId}.mp4`;
    }
    const lessons = await Lesson.find({ course: lesson.course }).sort({ order: 1, createdAt: 1 }).select("_id title").lean();
    const index = lessons.findIndex((item) => String(item._id) === String(lesson._id));
    return res.json({
      success: true,
      lesson: { ...lesson, id: String(lesson._id), courseTitle: course.title, isCompleted: Boolean(enrollment?.completedLessons?.some((id) => String(id) === String(lesson._id))), previousLessonId: index > 0 ? String(lessons[index - 1]._id) : null, nextLessonId: index >= 0 && index < lessons.length - 1 ? String(lessons[index + 1]._id) : null },
      isEnrolled: Boolean(enrollment),
    });
  } catch (error) {
    console.error("Student lesson access error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to open this lesson." });
  }
};

exports.markLessonComplete = async (req, res) => {
  if (invalidId(req.params.lessonId)) return res.status(400).json({ success: false, message: "Invalid lesson ID." });
  try {
    const lesson = await Lesson.findById(req.params.lessonId).select("course title").lean();
    if (!lesson) return res.status(404).json({ success: false, message: "Lesson not found." });
    const existingEnrollment = await Enrollment.findOne({ student: req.user.id, course: lesson.course }).select("completedLessons").lean();
    if (!existingEnrollment) return res.status(403).json({ success: false, message: "Enroll in this course to save your progress." });
    const wasCompleted = (existingEnrollment.completedLessons || []).some((id) => String(id) === String(lesson._id));
    const enrollment = await Enrollment.findOneAndUpdate(
      { student: req.user.id, course: lesson.course },
      { $addToSet: { completedLessons: lesson._id } },
      { new: true }
    );
    if (!enrollment) return res.status(403).json({ success: false, message: "Enroll in this course to save your progress." });
    if (!wasCompleted) {
      const course = await Course.findById(lesson.course).select("title").lean();
      await notifyStudent(req.user.id, {
        type: "progress",
        title: "Lesson completed",
        message: `${lesson.title} is complete${course?.title ? ` in ${course.title}` : ""}. Your learning progress has been updated.`,
        linkPath: "/progress",
      });
    }
    const certificate = await issueCertificateIfComplete(enrollment._id);
    return res.json({ success: true, message: "Lesson marked complete.", completedLessons: enrollment.completedLessons.map(String), certificateCode: certificate.enrollment?.certificateCode || "" });
  } catch (error) {
    console.error("Lesson progress update error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save lesson progress." });
  }
};
