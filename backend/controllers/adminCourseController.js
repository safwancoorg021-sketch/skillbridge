const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const { removeStoredVideo } = require("../middleware/videoUpload");
const { removeCloudinaryImage, storeCloudinaryImage } = require("../utils/cloudinaryImages");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const serialize = (course) => ({ ...course, id: String(course._id), _id: undefined });
const thumbnailDirectory = path.join(__dirname, "..", "uploads", "course-thumbnails");
const thumbnailUrlPrefix = "/uploads/course-thumbnails/";

async function storeThumbnail(imageDataUrl) {
  // An empty value means the course is keeping its existing thumbnail (or no
  // thumbnail was selected). Only validate and store an image when one was sent.
  if (typeof imageDataUrl !== "string" || !imageDataUrl.trim()) return "";

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageDataUrl);
  if (!match) {
    throw Object.assign(new Error("Choose a valid JPEG image."), { status: 400 });
  }
  if (match[1].length > 1_400_000) {
    throw Object.assign(new Error("The processed thumbnail must be under 1 MB."), { status: 400 });
  }
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > 1_000_000 || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw Object.assign(new Error("The thumbnail could not be processed. Choose another image."), { status: 400 });
  }
  return storeCloudinaryImage(imageDataUrl, "course-thumbnails");
}

async function removeStoredThumbnail(imageUrl) {
  await removeCloudinaryImage(imageUrl, "course-thumbnails");
  if (typeof imageUrl !== "string" || !imageUrl.startsWith(thumbnailUrlPrefix)) return;
  const filename = imageUrl.slice(thumbnailUrlPrefix.length);
  if (!/^[a-f0-9-]{36}\.jpg$/i.test(filename)) return;
  try {
    await fs.unlink(path.join(thumbnailDirectory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Unable to remove old course thumbnail:", error.message);
  }
}

function cleanCourseInput(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const price = Number(body.price ?? 0);
  const requirements = Array.isArray(body.requirements)
    ? body.requirements.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
    : typeof body.requirements === "string"
      ? body.requirements.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 30)
      : [];

  if (title.length < 3 || title.length > 120) throw Object.assign(new Error("Course title must be 3–120 characters."), { status: 400 });
  if (description.length < 10 || description.length > 10000) throw Object.assign(new Error("Description must be 10–10,000 characters."), { status: 400 });
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw Object.assign(new Error("Enter a valid course price."), { status: 400 });

  return {
    title,
    description,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 80) : "General",
    level: ["Beginner", "Intermediate", "Advanced"].includes(body.level) ? body.level : "Beginner",
    price,
    isFree: Boolean(body.isFree) || price === 0,
    discountPrice: Number.isFinite(Number(body.discountPrice)) && Number(body.discountPrice) >= 0 ? Number(body.discountPrice) : 0,
    instructor: typeof body.instructor === "string" ? body.instructor.trim().slice(0, 120) : "",
    requirements,
  };
}


exports.createCourse = async (req, res) => {
  let thumbnailUrl = "";
  try {
    const fields = cleanCourseInput(req.body);
    thumbnailUrl = await storeThumbnail(req.body?.thumbnailDataUrl);
    const course = await Course.create({ ...fields, thumbnail: thumbnailUrl });
    return res.status(201).json({ success: true, thumbnailUploadSupported: true, message: "Course created as a draft.", course: serialize(course.toObject()) });
  } catch (error) {
    if (thumbnailUrl) await removeStoredThumbnail(thumbnailUrl);
    return sendError(res, error.message, error.status || (error.name === "ValidationError" ? 400 : 500));
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const filter = search ? { $or: [
      { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      { category: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    ] } : {};
    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);
    const courseIds = courses.map((course) => course._id);
    const [lessonCounts, moduleCounts] = await Promise.all([
      Lesson.aggregate([{ $match: { course: { $in: courseIds } } }, { $group: { _id: "$course", count: { $sum: 1 } } }]),
      CourseModule.aggregate([{ $match: { course: { $in: courseIds } } }, { $group: { _id: "$course", count: { $sum: 1 } } }]),
    ]);
    const lessonsByCourse = new Map(lessonCounts.map((item) => [String(item._id), item.count]));
    const modulesByCourse = new Map(moduleCounts.map((item) => [String(item._id), item.count]));
    return res.json({
      success: true,
      courses: courses.map((course) => ({ ...serialize(course), lessonCount: lessonsByCourse.get(String(course._id)) || 0, moduleCount: modulesByCourse.get(String(course._id)) || 0 })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, "Unable to load courses right now.");
  }
};

exports.getCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid course ID.", 400);
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return sendError(res, "Course not found.", 404);
    return res.json({ success: true, course: serialize(course) });
  } catch (error) {
    return sendError(res, "Unable to load this course.");
  }
};

exports.updateCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid course ID.", 400);
  let newThumbnailUrl = "";
  try {
    const fields = cleanCourseInput(req.body);
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, "Course not found.", 404);
    const oldThumbnailUrl = course.thumbnail;
    newThumbnailUrl = await storeThumbnail(req.body?.thumbnailDataUrl);
    Object.assign(course, fields);
    if (newThumbnailUrl) course.thumbnail = newThumbnailUrl;
    else if (req.body?.removeThumbnail === true) course.thumbnail = "";
    await course.save();
    if (course.thumbnail !== oldThumbnailUrl) await removeStoredThumbnail(oldThumbnailUrl);
    return res.json({ success: true, thumbnailUploadSupported: true, message: "Course updated.", course: serialize(course.toObject()) });
  } catch (error) {
    if (newThumbnailUrl) await removeStoredThumbnail(newThumbnailUrl);
    return sendError(res, error.message, error.status || (error.name === "ValidationError" ? 400 : 500));
  }
};

exports.deleteCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid course ID.", 400);
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, "Course not found.", 404);
    const lessons = await Lesson.find({ course: course._id }).select("videoUrl").lean();
    await course.deleteOne();
    await removeStoredThumbnail(course.thumbnail);
    await Promise.all([
      CourseModule.deleteMany({ course: course._id }),
      Lesson.deleteMany({ course: course._id }),
      Enrollment.deleteMany({ course: course._id }),
      ...lessons.map((lesson) => removeStoredVideo(lesson.videoUrl)),
    ]);
    return res.json({ success: true, message: "Course and its lessons were deleted." });
  } catch (error) {
    return sendError(res, "Unable to delete this course.");
  }
};

exports.togglePublish = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid course ID.", 400);
  if (typeof req.body?.isPublished !== "boolean") return sendError(res, "Choose whether to publish this course.", 400);
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, "Course not found.", 404);
    if (req.body.isPublished && !course.isPublished) {
      const lessonCount = await Lesson.countDocuments({ course: course._id });
      if (!lessonCount) return sendError(res, "Add at least one lesson before publishing.", 400);
    }
    course.isPublished = req.body.isPublished;
    await course.save();
    return res.json({ success: true, message: course.isPublished ? "Course published." : "Course unpublished.", course: serialize(course.toObject()) });
  } catch (error) {
    return sendError(res, "Unable to change the course publishing status.");
  }
};
