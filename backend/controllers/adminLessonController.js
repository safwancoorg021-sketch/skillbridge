const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const { removeStoredVideo, videoUrlPrefix } = require("../middleware/videoUpload");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getCurriculum = async (req, res) => {
  if (!validId(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  try {
    const course = await Course.findById(req.params.courseId).select("_id").lean();
    if (!course) return sendError(res, "Course not found.", 404);
    const [modules, lessons] = await Promise.all([
      CourseModule.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
      Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
    ]);
    return res.json({
      success: true,
      modules: modules.map((module) => ({
        id: String(module._id),
        title: module.title,
        order: module.order,
        lessons: lessons.filter((lesson) => String(lesson.module) === String(module._id)).map((lesson) => ({ ...lesson, id: String(lesson._id) })),
      })),
    });
  } catch (error) {
    console.error("Admin curriculum load error:", error.message);
    return sendError(res, "Unable to load course lessons.");
  }
};

exports.addModule = async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (title.length < 2 || title.length > 120) return sendError(res, "Module title must be 2–120 characters.", 400);
  if (!validId(req.params.courseId)) return sendError(res, "Invalid course ID.", 400);
  try {
    const course = await Course.findById(req.params.courseId).select("_id").lean();
    if (!course) return sendError(res, "Course not found.", 404);
    const count = await CourseModule.countDocuments({ course: course._id });
    const module = await CourseModule.create({ course: course._id, title, order: Number(req.body.order) || count + 1 });
    return res.status(201).json({ success: true, message: "Module added.", module: { id: String(module._id), title: module.title, order: module.order, lessons: [] } });
  } catch (error) {
    return sendError(res, error.name === "ValidationError" ? error.message : "Unable to add this module.", error.name === "ValidationError" ? 400 : 500);
  }
};

exports.updateModule = async (req, res) => {
  if (!validId(req.params.moduleId)) return sendError(res, "Invalid module ID.", 400);
  const fields = {};
  if (req.body?.title !== undefined) {
    if (typeof req.body.title !== "string" || req.body.title.trim().length < 2 || req.body.title.trim().length > 120) return sendError(res, "Module title must be 2–120 characters.", 400);
    fields.title = req.body.title.trim();
  }
  if (req.body?.order !== undefined) fields.order = Math.max(1, Number(req.body.order) || 1);
  try {
    const module = await CourseModule.findByIdAndUpdate(req.params.moduleId, { $set: fields }, { new: true, runValidators: true }).lean();
    if (!module) return sendError(res, "Module not found.", 404);
    return res.json({ success: true, message: "Module updated.", module: { id: String(module._id), title: module.title, order: module.order } });
  } catch (error) {
    return sendError(res, "Unable to update this module.");
  }
};

exports.deleteModule = async (req, res) => {
  if (!validId(req.params.moduleId)) return sendError(res, "Invalid module ID.", 400);
  try {
    const module = await CourseModule.findById(req.params.moduleId);
    if (!module) return sendError(res, "Module not found.", 404);
    const lessons = await Lesson.find({ module: module._id }).select("_id videoUrl").lean();
    const lessonIds = lessons.map((lesson) => lesson._id);
    await module.deleteOne();
    await Promise.all([
      Lesson.deleteMany({ module: module._id }),
      Enrollment.updateMany({ course: module.course }, { $pull: { completedLessons: { $in: lessonIds } } }),
      ...lessons.map((lesson) => removeStoredVideo(lesson.videoUrl)),
    ]);
    return res.json({ success: true, message: "Module and its lessons deleted." });
  } catch (error) {
    return sendError(res, "Unable to delete this module.");
  }
};

function validateLesson(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = body.type || "video";
  if (title.length < 2 || title.length > 160) return { error: "Lesson title must be 2–160 characters." };
  if (!["video", "article"].includes(type)) return { error: "Choose video or article lesson type." };
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const storedLocalVideo = /^\/uploads\/course-videos\/[a-f0-9-]{36}\.mp4$/i.test(videoUrl);
  const storedCloudinaryVideo = /^cloudinary:\/\/[a-f0-9-]{36}$/i.test(videoUrl);
  if (type === "video" && !storedLocalVideo && !storedCloudinaryVideo) {
    return { error: "Upload a video file to this lesson. External video links are disabled." };
  }
  if (type === "article" && (!content || content.length > 50000)) return { error: "Article content is required and must be under 50,000 characters." };
  const durationMin = Number(body.durationMin || 0);
  if (!Number.isFinite(durationMin) || durationMin < 0 || durationMin > 10000) return { error: "Enter a valid lesson duration." };
  const isPreview = body.isPreview === true || body.isPreview === "true";
  return { value: { title, type, videoUrl: type === "video" ? videoUrl : "", content: type === "article" ? content : "", durationMin, isPreview } };
}

exports.addLesson = async (req, res) => {
  if (!validId(req.params.moduleId)) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, "Invalid module ID.", 400);
  }
  const { error, value } = validateLesson(req.body);
  if (error) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, error, 400);
  }
  try {
    const module = await CourseModule.findById(req.params.moduleId).lean();
    if (!module) {
      await removeStoredVideo(req.compressedVideoUrl);
      return sendError(res, "Module not found.", 404);
    }
    const count = await Lesson.countDocuments({ module: module._id });
    const lesson = await Lesson.create({ ...value, course: module.course, module: module._id, order: Math.max(1, Number(req.body.order) || count + 1) });
    return res.status(201).json({ success: true, message: "Lesson added.", lesson: { ...lesson.toObject(), id: String(lesson._id) } });
  } catch (error) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, error.name === "ValidationError" ? error.message : "Unable to add this lesson.", error.name === "ValidationError" ? 400 : 500);
  }
};

exports.updateLesson = async (req, res) => {
  if (!validId(req.params.lessonId)) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, "Invalid lesson ID.", 400);
  }
  const { error, value } = validateLesson(req.body);
  if (error) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, error, 400);
  }
  if (req.body.order !== undefined) value.order = Math.max(1, Number(req.body.order) || 1);
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      await removeStoredVideo(req.compressedVideoUrl);
      return sendError(res, "Lesson not found.", 404);
    }
    const oldVideoUrl = lesson.videoUrl;
    Object.assign(lesson, value);
    await lesson.save();
    if (oldVideoUrl !== lesson.videoUrl) await removeStoredVideo(oldVideoUrl);
    return res.json({ success: true, message: "Lesson updated.", lesson: { ...lesson.toObject(), id: String(lesson._id) } });
  } catch (error) {
    await removeStoredVideo(req.compressedVideoUrl);
    return sendError(res, "Unable to update this lesson.");
  }
};

exports.deleteLesson = async (req, res) => {
  if (!validId(req.params.lessonId)) return sendError(res, "Invalid lesson ID.", 400);
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.lessonId);
    if (!lesson) return sendError(res, "Lesson not found.", 404);
    await removeStoredVideo(lesson.videoUrl);
    await Enrollment.updateMany({ course: lesson.course }, { $pull: { completedLessons: lesson._id } });
    return res.json({ success: true, message: "Lesson deleted." });
  } catch (error) {
    return sendError(res, "Unable to delete this lesson.");
  }
};
