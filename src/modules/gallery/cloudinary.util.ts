import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import sharp from "sharp";
import config from "../../config";
import CustomError from "../../helpers/CustomError";
import { MediaType } from "./gallery.interface";

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface CloudinaryUploadResult {
  imageUrl: string;
  publicId: string;
  mediaType: MediaType;
}

/**
 * Pre-compress raw image buffer using Sharp:
 * - Auto-rotates based on EXIF tag
 * - Resizes max dimensions to 1920x1080 (maintaining aspect ratio)
 * - Converts to optimized WebP format at 80% quality
 */
const compressImageBuffer = async (rawBuffer: Buffer): Promise<Buffer> => {
  try {
    return await sharp(rawBuffer)
      .rotate()
      .resize({
        width: 1920,
        height: 1080,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err: any) {
    console.warn(
      "[Sharp Compression Warning]: Could not process image buffer, falling back to raw buffer.",
      err?.message,
    );
    return rawBuffer;
  }
};

/**
 * Upload single media (image or video) file buffer to Cloudinary
 */
export const uploadMediaToCloudinary = async (
  fileBuffer: Buffer,
  mimetype: string,
  folder = "evergain_gallery",
): Promise<CloudinaryUploadResult> => {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;

  const isVideo = mimetype.startsWith("video/");
  const mediaType: MediaType = isVideo ? "video" : "image";

  // Mock / Sandbox Fallback if credentials are missing or placeholder in dev
  if (!cloudName || cloudName === "your_cloud_name" || !apiKey || !apiSecret) {
    console.warn(
      "[Cloudinary] Credentials unconfigured/placeholder. Returning simulated mock media upload result.",
    );
    const mockId = `mock_gallery_${Date.now()}`;
    return {
      imageUrl: isVideo
        ? "https://res.cloudinary.com/demo/video/upload/dog.mp4"
        : "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80",
      publicId: mockId,
      mediaType,
    };
  }

  // Pre-compress buffer if it's an image
  let uploadBuffer = fileBuffer;
  if (!isVideo) {
    uploadBuffer = await compressImageBuffer(fileBuffer);
  }

  const uploadOptions: Record<string, any> = {
    folder,
    resource_type: isVideo ? "video" : "image",
  };

  if (!isVideo) {
    uploadOptions["allowed_formats"] = ["jpg", "jpeg", "png", "webp"];
    uploadOptions["transformation"] = [
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ];
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: any, result?: UploadApiResponse) => {
        if (error || !result) {
          console.error("[Cloudinary Upload Error]:", error);
          return reject(
            new CustomError(500, `Cloudinary media upload failed: ${error?.message || "Unknown error"}`),
          );
        }
        resolve({
          imageUrl: result.secure_url,
          publicId: result.public_id,
          mediaType,
        });
      },
    );

    stream.end(uploadBuffer);
  });
};

/**
 * Delete media (image or video) from Cloudinary by public ID
 */
export const deleteFromCloudinary = async (
  publicId: string,
  mediaType: MediaType = "image",
): Promise<boolean> => {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;

  if (!cloudName || cloudName === "your_cloud_name" || publicId.startsWith("mock_")) {
    console.warn("[Cloudinary] Simulated mock delete for publicId:", publicId);
    return true;
  }

  try {
    const resourceType = mediaType === "video" ? "video" : "image";
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result.result === "ok" || result.result === "not found";
  } catch (error: any) {
    console.error("[Cloudinary Delete Error]:", error);
    throw new CustomError(500, `Failed to delete media from Cloudinary: ${error?.message || "Error"}`);
  }
};
