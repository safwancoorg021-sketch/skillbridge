const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const User = require("../models/User");
const { getCloudinaryVideoId, getSignedVideoUrl } = require("../config/cloudinary");

const videoDirectory = path.resolve(__dirname, "..", "uploads", "course-videos");
const videoUrlPrefix = "/uploads/course-videos/";
const cookieName = "skillbridge_video_access";
const cookiePath = "/api/lessons/videos";
const accessDurationMs = 4 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: cookiePath,
    maxAge: accessDurationMs,
  };
}

function createSignedAccess(userId, lessonId) {
  const payload = Buffer.from(JSON.stringify({
    userId: String(userId),
    lessonId: String(lessonId),
    expiresAt: Date.now() + accessDurationMs,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return "";
  try { return decodeURIComponent(cookie.slice(name.length + 1)); } catch { return ""; }
}

function verifySignedAccess(token) {
  if (!process.env.JWT_SECRET || typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || !decoded.lessonId || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt <= Date.now()) return null;
    return decoded;
  } catch { return null; }
}

exports.issueVideoAccess = (res, userId, lessonId) => {
  if (!process.env.JWT_SECRET) throw new Error("Video access signing is not configured.");
  res.cookie(cookieName, createSignedAccess(userId, lessonId), cookieOptions());
};

exports.clearVideoAccess = (_req, res) => {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(cookieName, options);
  return res.status(204).end();
};

function sendRangeError(res, size) {
  res.set("Content-Range", `bytes */${size}`);
  return res.status(416).end();
}

function streamFile(filePath, range, res) {
  const videoStream = range ? fs.createReadStream(filePath, range) : fs.createReadStream(filePath);
  videoStream.on("error", (error) => {
    console.error("Course video stream error:", error.message);
    if (res.headersSent) res.destroy(error);
    else res.status(500).end();
  });
  return videoStream.pipe(res);
}

function streamCloudinaryVideo(url, req, res) {
  return new Promise((resolve) => {
    const headers = req.headers.range ? { Range: req.headers.range } : {};
    const upstreamRequest = https.request(url, { method: req.method, headers, timeout: 60000 }, (upstream) => {
      const status = upstream.statusCode || 502;
      if (![200, 206, 416].includes(status)) {
        upstream.resume();
        return res.status(502).json({ success: false, message: "Unable to stream this lesson video." }), resolve();
      }

      res.status(status);
      res.set({
        "Accept-Ranges": upstream.headers["accept-ranges"] || "bytes",
        "Cache-Control": "private, no-store",
        "Content-Type": upstream.headers["content-type"]?.startsWith("video/") ? upstream.headers["content-type"] : "video/mp4",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie",
      });
      for (const header of ["content-length", "content-range", "etag", "last-modified"]) {
        if (upstream.headers[header]) res.set(header, upstream.headers[header]);
      }
      if (req.method === "HEAD" || status === 416) {
        upstream.resume();
        res.end();
        return resolve();
      }
      upstream.once("error", (error) => {
        console.error("Cloudinary video stream error:", error.message);
        if (res.headersSent) res.destroy(error);
        else res.status(502).end();
        resolve();
      });
      upstream.once("end", resolve);
      upstream.pipe(res);
    });
    upstreamRequest.once("error", (error) => {
      console.error("Cloudinary video request error:", error.message);
      if (!res.headersSent) res.status(502).json({ success: false, message: "Unable to stream this lesson video." });
      else res.end();
      resolve();
    });
    upstreamRequest.once("timeout", () => upstreamRequest.destroy(new Error("Cloudinary video request timed out.")));
    upstreamRequest.end();
  });
}

exports.streamVideo = async (req, res) => {
  const filename = req.params.filename;
  const requestedVideo = /^([a-f0-9-]{36})\.mp4$/i.exec(filename || "");
  if (!requestedVideo) return res.status(404).end();
  const requestedVideoId = requestedVideo[1];

  const access = verifySignedAccess(readCookie(req, cookieName));
  if (!access) return res.status(401).json({ success: false, message: "Open the course lesson to access this video." });

  try {
    const [user, lesson] = await Promise.all([
      User.findById(access.userId).select("role isBlocked").lean(),
      Lesson.findById(access.lessonId).select("course videoUrl isPreview").lean(),
    ]);
    const cloudinaryVideoId = getCloudinaryVideoId(lesson?.videoUrl);
    const isLocalVideo = lesson?.videoUrl === `${videoUrlPrefix}${filename}`;
    const isCloudinaryVideo = cloudinaryVideoId && cloudinaryVideoId.toLowerCase() === requestedVideoId.toLowerCase();
    if (!user || user.role !== "student" || user.isBlocked || !lesson || (!isLocalVideo && !isCloudinaryVideo)) {
      return res.status(403).json({ success: false, message: "You do not have access to this course video." });
    }

    const course = await Course.findOne({ _id: lesson.course, isPublished: true }).select("_id").lean();
    if (!course) return res.status(404).json({ success: false, message: "This course is not available." });
    if (!lesson.isPreview) {
      const enrollment = await Enrollment.exists({ student: user._id, course: lesson.course });
      if (!enrollment) return res.status(403).json({ success: false, message: "Enroll in this course to watch this video." });
    }

    if (isCloudinaryVideo) {
      let signedUrl;
      try {
        signedUrl = getSignedVideoUrl(cloudinaryVideoId);
      } catch (error) {
        const status = error.status || 503;
        return res.status(status).json({ success: false, message: status === 503 ? "Cloudinary video storage is not configured on the backend." : "Unable to stream this lesson video." });
      }
      res.set({ "Cache-Control": "private, no-store", Vary: "Cookie" });
      return await streamCloudinaryVideo(signedUrl, req, res);
    }

    const filePath = path.join(videoDirectory, filename);
    const file = await fs.promises.stat(filePath).catch(() => null);
    if (!file?.isFile()) return res.status(404).json({ success: false, message: "This lesson video is unavailable." });

    res.set({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Type": "video/mp4",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    });

    const range = req.headers.range;
    if (!range) {
      res.set("Content-Length", file.size);
      if (req.method === "HEAD") return res.status(200).end();
      return streamFile(filePath, null, res);
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return sendRangeError(res, file.size);
    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;
    if (start === null) {
      const suffixLength = end;
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return sendRangeError(res, file.size);
      start = Math.max(file.size - suffixLength, 0);
      end = file.size - 1;
    } else if (end === null || end >= file.size) {
      end = file.size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= file.size || end < start) {
      return sendRangeError(res, file.size);
    }

    res.status(206);
    res.set({
      "Content-Range": `bytes ${start}-${end}/${file.size}`,
      "Content-Length": end - start + 1,
    });
    if (req.method === "HEAD") return res.end();
    return streamFile(filePath, { start, end }, res);
  } catch (error) {
    console.error("Protected course video error:", error.message);
    if (!res.headersSent) return res.status(500).json({ success: false, message: "Unable to stream this lesson video." });
    return res.end();
  }
};
