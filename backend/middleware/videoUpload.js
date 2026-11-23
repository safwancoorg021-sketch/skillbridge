const crypto = require("crypto");
const { createReadStream } = require("fs");
const fs = require("fs/promises");
const multer = require("multer");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { cloudinaryVideoPointer, getCloudinary, getCloudinaryIfConfigured, getCloudinaryVideoId, publicVideoId } = require("../config/cloudinary");

const temporaryDirectory = path.join(os.tmpdir(), "skillbridge-video-source");
const videoUrlPrefix = "/uploads/course-videos/";
const maxSourceBytes = 250 * 1024 * 1024;
const acceptedVideoTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "video/ogg",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      fs.mkdir(temporaryDirectory, { recursive: true }).then(
        () => callback(null, temporaryDirectory),
        callback
      );
    },
    filename(_req, _file, callback) {
      callback(null, `${crypto.randomUUID()}.source`);
    },
  }),
  limits: { fileSize: maxSourceBytes, files: 1 },
  fileFilter(_req, file, callback) {
    if (!acceptedVideoTypes.has(file.mimetype)) {
      const error = new Error("Choose an MP4, WebM, MOV, AVI, MKV, or OGG video.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

function receiveVideo(req, res, next) {
  upload.single("video")(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) fs.unlink(req.file.path).catch(() => {});
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : error.status || 400;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Choose a video smaller than 250 MB."
      : error.message || "Unable to read this video upload.";
    return res.status(status).json({ success: false, message });
  });
}

function runCompression(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(Object.assign(new Error("Video compression is not available."), { status: 503 }));
    const ffmpegProcess = spawn(ffmpegPath, [
      "-nostdin",
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", "scale=w='min(1280,iw)':h=-2",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "27",
      "-maxrate", "2500k",
      "-bufsize", "5000k",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-f", "mp4",
      outputPath,
    ], { windowsHide: true });
    let stderr = "";
    ffmpegProcess.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ffmpegProcess.once("error", reject);
    ffmpegProcess.once("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.slice(-1000) || "FFmpeg could not process this video."));
    });
  });
}

async function compressUploadedVideo(req, res, next) {
  if (!req.file) return next();
  const videoId = crypto.randomUUID();
  const outputPath = path.join(temporaryDirectory, `${videoId}.mp4`);
  try {
    getCloudinary();
    await fs.mkdir(temporaryDirectory, { recursive: true });
    await runCompression(req.file.path, outputPath);
    const stats = await fs.stat(outputPath);
    if (!stats.size) throw new Error("The compressed video is empty.");

    await uploadCompressedVideo(outputPath, videoId);
    req.compressedVideoUrl = cloudinaryVideoPointer(videoId);
    req.body ||= {};
    req.body.videoUrl = req.compressedVideoUrl;
    return next();
  } catch (error) {
    await fs.unlink(outputPath).catch(() => {});
    await fs.unlink(req.file.path).catch(() => {});
    const status = error.status || 400;
    console.error("Lesson video processing error:", error.code === "CLOUDINARY_UPLOAD_FAILED" ? "Cloudinary upload failed." : error.message);
    return res.status(status).json({
      success: false,
      message: error.code === "CLOUDINARY_NOT_CONFIGURED"
        ? "Add your Cloudinary credentials to backend/.env and restart the backend to upload videos."
        : status === 503
          ? "Video compression is unavailable. Restart the backend after installing its video tools."
          : error.code === "CLOUDINARY_UPLOAD_FAILED"
            ? "Cloudinary could not store this video. Check your Cloudinary account and try again."
            : "This video could not be processed. Choose another supported video file.",
    });
  } finally {
    await fs.unlink(outputPath).catch(() => {});
    await fs.unlink(req.file.path).catch(() => {});
  }
}

function uploadCompressedVideo(filePath, videoId, { overwrite = false } = {}) {
  const cloudinary = getCloudinary();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      const uploadError = new Error("Cloudinary video upload failed.");
      uploadError.code = "CLOUDINARY_UPLOAD_FAILED";
      uploadError.status = 502;
      uploadError.cause = error;
      reject(uploadError);
    };
    const uploadStream = cloudinary.uploader.upload_chunked_stream({
      resource_type: "video",
      type: "authenticated",
      public_id: publicVideoId(videoId),
      overwrite,
      chunk_size: 20 * 1024 * 1024,
    }, (error, result) => {
      if (error) return fail(error);
      if (settled) return;
      settled = true;
      resolve(result);
    });
    const source = createReadStream(filePath);
    uploadStream.once("error", (error) => { source.destroy(); fail(error); });
    source.once("error", (error) => { uploadStream.destroy(error); fail(error); });
    source.pipe(uploadStream);
  });
}

async function removeStoredVideo(videoUrl) {
  const videoId = getCloudinaryVideoId(videoUrl);
  if (videoId) {
    const cloudinary = getCloudinaryIfConfigured();
    if (!cloudinary) {
      console.error("Cloudinary credentials are missing; unable to remove a stored lesson video.");
      return;
    }
    try {
      const result = await cloudinary.uploader.destroy(publicVideoId(videoId), { resource_type: "video", type: "authenticated", invalidate: true });
      if (result.result !== "ok" && result.result !== "not found") console.error("Cloudinary did not remove the stored lesson video.");
    } catch {
      console.error("Unable to remove a stored lesson video from Cloudinary.");
    }
    return;
  }
  if (typeof videoUrl !== "string" || !videoUrl.startsWith(videoUrlPrefix)) return;
  const filename = videoUrl.slice(videoUrlPrefix.length);
  if (!/^[a-f0-9-]{36}\.mp4$/i.test(filename)) return;
  const oldVideoDirectory = path.join(__dirname, "..", "uploads", "course-videos");
  await fs.unlink(path.join(oldVideoDirectory, filename)).catch((error) => {
    if (error.code !== "ENOENT") console.error("Unable to remove stored lesson video:", error.message);
  });
}

module.exports = { receiveVideo, compressUploadedVideo, removeStoredVideo, uploadCompressedVideo, videoUrlPrefix };
