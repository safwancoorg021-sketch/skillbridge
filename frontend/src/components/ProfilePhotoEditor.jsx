
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { ProfileAvatar } from "./ProfileAvatar.jsx";
import "./ProfilePhotoEditor.css";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_PROCESSED_BYTES = 900 * 1024;

function createCroppedImage(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to process the selected photo."));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 512, 512);

      context.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        512,
        512
      );

      const compress = (quality) =>
        new Promise((res) =>
          canvas.toBlob(res, "image/jpeg", quality)
        );

      (async () => {
        try {
          let blob = null;

          for (const quality of [0.85, 0.7, 0.55, 0.4]) {
            blob = await compress(quality);
            if (blob && blob.size <= MAX_PROCESSED_BYTES) break;
          }

          if (!blob || blob.size > MAX_PROCESSED_BYTES) {
            reject(new Error("Unable to compress this photo."));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () =>
            reject(new Error("Unable to read the cropped photo."));
          reader.readAsDataURL(blob);
        } catch {
          reject(new Error("Unable to process the cropped photo."));
        }
      })();
    };

    image.onerror = () =>
      reject(new Error("Unable to open the selected photo."));

    image.src = imageSrc;
  });
}

export function ProfilePhotoEditor({
  profile,
  onProfileUpdated,
  className = "",
  avatarClass = "",
}) {
  const { updateUser } = useAuth();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const imageUrlRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);

  const initials = (profile?.name || "User")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function cleanupImage() {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
  }

  function closeCropper() {
    if (busy) return;
    cleanupImage();
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedPixels(null);
    setError("");
  }

  function showMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPosition({
      top: Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 150)),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 188)),
    });

    setError("");
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeIfOutside = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) return;

      setMenuOpen(false);
    };

    const closeOnKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    const closeOnViewportChange = () => setMenuOpen(false);

    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnKey);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnKey);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => cleanupImage();
  }, []);

  async function selectPhoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) return;

    setError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }

    setBusy(true);

    try {
      const bitmap = await createImageBitmap(file);

      if (bitmap.width * bitmap.height > 60_000_000) {
        bitmap.close();
        throw new Error("Choose a photo with smaller dimensions.");
      }

      bitmap.close();

      cleanupImage();

      const url = URL.createObjectURL(file);
      imageUrlRef.current = url;

      setImageSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedPixels(null);
      setMenuOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to open this photo.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCroppedPhoto() {
    if (!imageSrc || !croppedPixels || busy) return;

    setBusy(true);
    setError("");

    try {
      const imageDataUrl = await createCroppedImage(
        imageSrc,
        croppedPixels
      );

      const data = await api("/auth/me/profile-image", {
        method: "POST",
        auth: true,
        body: { imageDataUrl },
      });

      updateUser(data.user);
      onProfileUpdated?.(data.user);

      cleanupImage();
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedPixels(null);
    } catch (requestError) {
      setError(requestError.message || "Unable to update your profile photo.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setError("");
    setBusy(true);

    try {
      const data = await api("/auth/me/profile-image", {
        method: "DELETE",
        auth: true,
      });

      updateUser(data.user);
      onProfileUpdated?.(data.user);
      setMenuOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to remove your profile photo.");
    } finally {
      setBusy(false);
    }
  }

  const wrapperClass = [
    "profile-photo-popover",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass}>
      <button
        ref={triggerRef}
        type="button"
        className="profile-photo-trigger"
        aria-label="Profile photo options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={showMenu}
      >
        <ProfileAvatar
          profileImage={profile?.profileImage}
          initials={initials}
          className={avatarClass || "profile-photo-avatar"}
        />
        <span className="profile-photo-camera" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>

      <input
        ref={inputRef}
        className="profile-photo-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={selectPhoto}
        aria-label="Choose a profile photo"
      />

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          className="profile-photo-menu"
          role="menu"
          aria-label="Profile photo actions"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Updating photo…" : profile?.profileImage ? "Change photo" : "Add photo"}
          </button>

          {profile?.profileImage && (
            <button
              type="button"
              role="menuitem"
              className="remove"
              onClick={removePhoto}
              disabled={busy}
            >
              {busy ? "Please wait…" : "Remove photo"}
            </button>
          )}

          <small>JPG, PNG, or WebP · up to 10 MB</small>
          {error && <p className="profile-photo-menu-error" role="alert">{error}</p>}
        </div>,
        document.body
      )}

      {imageSrc && createPortal(
        <div className="photo-crop-overlay">
          <section
            className="photo-crop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-crop-title"
          >
            <h2 id="photo-crop-title">Adjust your profile photo</h2>
            <p className="photo-crop-description">
              Drag to reposition and zoom to get the perfect picture.
            </p>

            <div className="photo-crop-area">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedPixels(pixels)}
                minZoom={1}
                maxZoom={3}
              />
            </div>

            <div className="photo-zoom-control">
              <label htmlFor="photo-zoom">Zoom</label>
              <input
                id="photo-zoom"
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              <span>{zoom.toFixed(2)}×</span>
            </div>

            {error && (
              <p className="photo-crop-error" role="alert">{error}</p>
            )}

            <div className="photo-crop-actions">
              <button
                type="button"
                className="photo-crop-reset"
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                disabled={busy}
              >
                Reset
              </button>

              <button
                type="button"
                className="photo-crop-cancel"
                onClick={closeCropper}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="photo-crop-save"
                onClick={uploadCroppedPhoto}
                disabled={busy || !croppedPixels}
              >
                {busy ? "Uploading…" : "Save photo"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}
