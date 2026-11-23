const cloudinary = require("cloudinary").v2;

const courseVideoPrefix = "cloudinary://";
const videoIdPattern = /^[a-f0-9-]{36}$/i;

function configureCloudinary() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      if (parsed.protocol !== "cloudinary:" || !parsed.hostname || !parsed.username || !parsed.password) return false;
      cloudinary.config({
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
        secure: true,
      });
    } catch {
      return false;
    }
  } else {
    const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
    if (!cloud_name || !api_key || !api_secret) return false;
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  }
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

function getCloudinary() {
  if (!configureCloudinary()) {
    const error = new Error("Cloudinary video storage is not configured.");
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }
  return cloudinary;
}

function getCloudinaryIfConfigured() {
  return configureCloudinary() ? cloudinary : null;
}

function publicVideoId(videoId) {
  if (!videoIdPattern.test(videoId || "")) throw new Error("Invalid Cloudinary video ID.");
  return `skillbridge/course-videos/${videoId}`;
}

function cloudinaryVideoPointer(videoId) {
  if (!videoIdPattern.test(videoId || "")) throw new Error("Invalid Cloudinary video ID.");
  return `${courseVideoPrefix}${videoId}`;
}

function getCloudinaryVideoId(videoUrl) {
  const match = typeof videoUrl === "string" ? /^cloudinary:\/\/([a-f0-9-]{36})$/i.exec(videoUrl) : null;
  return match ? match[1] : "";
}

function getSignedVideoUrl(videoId) {
  return getCloudinary().url(publicVideoId(videoId), {
    resource_type: "video",
    type: "authenticated",
    secure: true,
    sign_url: true,
    format: "mp4",
  });
}

module.exports = {
  courseVideoPrefix,
  cloudinaryVideoPointer,
  getCloudinary,
  getCloudinaryIfConfigured,
  getCloudinaryVideoId,
  getSignedVideoUrl,
  publicVideoId,
};
