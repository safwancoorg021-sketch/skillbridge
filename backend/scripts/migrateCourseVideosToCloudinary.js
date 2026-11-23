require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const { cloudinaryVideoPointer, getCloudinary } = require("../config/cloudinary");
const { uploadCompressedVideo, removeStoredVideo, videoUrlPrefix } = require("../middleware/videoUpload");

const videoDirectory = path.join(__dirname, "..", "uploads", "course-videos");

async function migrateCourseVideos() {
  getCloudinary();
  await mongoose.connect(process.env.MONGODB_URI);
  const lessons = await Lesson.find({ videoUrl: { $regex: /^\/uploads\/course-videos\/[a-f0-9-]{36}\.mp4$/i } }).select("title videoUrl").lean();
  let migrated = 0;
  let missing = 0;

  for (const lesson of lessons) {
    const filename = lesson.videoUrl.slice(videoUrlPrefix.length);
    const videoId = filename.replace(/\.mp4$/i, "");
    const localPath = path.join(videoDirectory, filename);
    const file = await fs.stat(localPath).catch(() => null);
    if (!file?.isFile()) {
      console.log(`Skipped missing local video for: ${lesson.title}`);
      missing += 1;
      continue;
    }

    const nextVideoUrl = cloudinaryVideoPointer(videoId);
    let lessonUpdated = false;
    try {
      await uploadCompressedVideo(localPath, videoId, { overwrite: true });
      const result = await Lesson.updateOne({ _id: lesson._id, videoUrl: lesson.videoUrl }, { $set: { videoUrl: nextVideoUrl } });
      if (result.modifiedCount !== 1) throw new Error("Lesson changed during video migration.");
      lessonUpdated = true;
      await fs.unlink(localPath);
      console.log(`Moved video to Cloudinary: ${lesson.title}`);
      migrated += 1;
    } catch (error) {
      if (!lessonUpdated) await removeStoredVideo(nextVideoUrl);
      throw error;
    }
  }

  console.log(`Migrated ${migrated} video(s) to Cloudinary; ${missing} local video file(s) were missing.`);
}

migrateCourseVideos()
  .catch((error) => {
    console.error("Unable to migrate course videos:", error.code === "CLOUDINARY_NOT_CONFIGURED" ? "Add Cloudinary credentials to backend/.env." : error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
