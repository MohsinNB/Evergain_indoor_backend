import Gallery from "./gallery.model";
import { IGallery } from "./gallery.interface";
import { uploadMediaToCloudinary, deleteFromCloudinary } from "./cloudinary.util";
import CustomError from "../../helpers/CustomError";
import { logAuditAction } from "../auditLog/auditLog.service";

/**
 * Fetch all gallery media items (sorted by displayOrder ASC, uploadedAt DESC)
 */
export const getAllGalleryImages = async (): Promise<IGallery[]> => {
  return Gallery.find().sort({ displayOrder: 1, uploadedAt: -1 }).lean() as Promise<IGallery[]>;
};

/**
 * Upload multiple media files (images & videos) in batch to Cloudinary & DB
 */
export const createMultipleGalleryMedia = async (
  files: Express.Multer.File[],
  caption?: string | undefined,
  startDisplayOrder = 0,
  adminId?: string,
): Promise<IGallery[]> => {
  if (!files || files.length === 0) {
    throw new CustomError(400, "At least one media file is required.");
  }

  // Upload all files concurrently to Cloudinary
  const uploadPromises = files.map(async (file, index) => {
    const cloudResult = await uploadMediaToCloudinary(file.buffer, file.mimetype);

    const docPayload: Record<string, any> = {
      imageUrl: cloudResult.imageUrl,
      mediaType: cloudResult.mediaType,
      cloudinaryPublicId: cloudResult.publicId,
      displayOrder: startDisplayOrder + index,
      uploadedAt: new Date(),
    };

    if (caption) {
      docPayload["caption"] = caption;
    }

    return Gallery.create(docPayload);
  });

  const createdItems = await Promise.all(uploadPromises);

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "gallery.upload",
    targetId: createdItems.map((i) => String(i._id)).join(","),
    afterState: { count: createdItems.length },
  });

  return createdItems;
};

/**
 * Update caption or display order of single gallery media item
 */
export const updateGalleryImage = async (
  id: string,
  updateData: { caption?: string | undefined; displayOrder?: number | undefined },
): Promise<IGallery> => {
  const item = await Gallery.findById(id);
  if (!item) {
    throw new CustomError(404, "Gallery media item not found.");
  }

  if (updateData.caption !== undefined) item.caption = updateData.caption;
  if (updateData.displayOrder !== undefined) item.displayOrder = updateData.displayOrder;

  await item.save();
  return item;
};

/**
 * Delete single media item from Cloudinary and DB
 */
export const deleteGalleryImage = async (id: string, adminId?: string): Promise<IGallery> => {
  const item = await Gallery.findById(id);
  if (!item) {
    throw new CustomError(404, "Gallery media item not found.");
  }

  // Delete from Cloudinary with mediaType context
  await deleteFromCloudinary(item.cloudinaryPublicId, item.mediaType);

  // Delete from MongoDB
  await item.deleteOne();

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "gallery.delete",
    targetId: id,
  });

  return item;
};

/**
 * Reorder display orders for multiple gallery media items in bulk
 */
export const reorderGalleryImages = async (
  orders: Array<{ id: string; displayOrder: number }>,
): Promise<IGallery[]> => {
  const bulkOps = orders.map((entry) => ({
    updateOne: {
      filter: { _id: entry.id },
      update: { $set: { displayOrder: entry.displayOrder } },
    },
  }));

  await Gallery.bulkWrite(bulkOps);

  return getAllGalleryImages();
};
