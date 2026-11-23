const crypto = require("crypto");
const { getCloudinary, getCloudinaryIfConfigured } = require("../config/cloudinary");

const imageIdPattern = /^[a-f0-9-]{36}$/i;

async function storeCloudinaryImage(imageDataUrl, folder) {
  const imageId = crypto.randomUUID();
  const result = await getCloudinary().uploader.upload(imageDataUrl, {
    resource_type: "image",
    public_id: `skillbridge/${folder}/${imageId}`,
    overwrite: false,
    format: "jpg",
  });

  if (!result?.secure_url) throw new Error("Cloudinary did not return a secure image URL.");
  return result.secure_url;
}

function cloudinaryImagePublicId(imageUrl, folder) {
  if (typeof imageUrl !== "string") return "";

  try {
    const url = new URL(imageUrl);
    if (url.hostname !== "res.cloudinary.com") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.indexOf("upload");
    if (uploadIndex < 0) return "";

    const assetSegments = segments.slice(uploadIndex + 1);
    if (/^v\d+$/.test(assetSegments[0] || "")) assetSegments.shift();
    if (assetSegments.length !== 3 || assetSegments[0] !== "skillbridge" || assetSegments[1] !== folder) return "";

    const match = /^([a-f0-9-]{36})\.jpg$/i.exec(assetSegments[2]);
    return match && imageIdPattern.test(match[1]) ? `skillbridge/${folder}/${match[1]}` : "";
  } catch {
    return "";
  }
}

async function removeCloudinaryImage(imageUrl, folder) {
  const publicId = cloudinaryImagePublicId(imageUrl, folder);
  if (!publicId) return;

  const cloudinary = getCloudinaryIfConfigured();
  if (!cloudinary) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
    if (result.result !== "ok" && result.result !== "not found") {
      console.error("Cloudinary did not remove the stored image.");
    }
  } catch {
    console.error("Unable to remove a stored image from Cloudinary.");
  }
}

module.exports = { removeCloudinaryImage, storeCloudinaryImage };
