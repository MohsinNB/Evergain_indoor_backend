import multer from "multer";
import CustomError from "../helpers/CustomError";

// Memory storage to get file buffers directly
const storage = multer.memoryStorage();

// File Filter for Images and Videos
const mediaFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedMimeTypes = [
    // Image Mime Types
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "image/gif",
    // Video Mime Types
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/mpeg",
    "video/mkv",
  ];

  if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        400,
        "Invalid file format. Only JPG, PNG, WEBP, GIF images and MP4, WEBM, MOV videos are allowed.",
      ) as any,
    );
  }
};

/**
 * Multer middleware supporting multiple media file uploads.
 * Tuned for stability on KVM 1 VPS (max 20MB per file, up to 5 files per batch).
 */
export const uploadMultipleMedia = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit per file
    files: 5,                   // Max 5 files per request batch
  },
  fileFilter: mediaFileFilter,
}).any(); // Accepts files from field names: 'files', 'image', 'images', 'media', etc.
