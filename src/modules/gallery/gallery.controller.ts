import { Request, Response, NextFunction } from "express";
import {
  getAllGalleryImages,
  createMultipleGalleryMedia,
  updateGalleryImage,
  deleteGalleryImage,
  reorderGalleryImages,
} from "./gallery.service";
import {
  updateGallerySchema,
  reorderGallerySchema,
} from "./gallery.validation";
import CustomError from "../../helpers/CustomError";

/**
 * GET /api/v1/gallery
 * Public: Fetch all gallery images & videos ordered by displayOrder & upload date.
 */
export const getGalleryHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const mediaList = await getAllGalleryImages();

    res.status(200).json({
      success: true,
      message: "Gallery media items fetched successfully.",
      data: mediaList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/gallery/upload
 * Admin: Upload single or multiple images/videos to Cloudinary and add to gallery.
 * Accepts files under fields: 'files', 'image', 'images', 'media', or any form-data field name.
 */
export const uploadGalleryImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let files: Express.Multer.File[] = [];

    if (Array.isArray(req.files) && req.files.length > 0) {
      files = req.files;
    } else if (req.file) {
      files = [req.file];
    } else if (req.files && typeof req.files === "object") {
      // Handle multer fields object format
      files = Object.values(req.files).flat();
    }

    if (files.length === 0) {
      return next(
        new CustomError(
          400,
          "No media file(s) uploaded. Please select one or more image/video files.",
        ),
      );
    }

    const caption = req.body.caption ? String(req.body.caption).trim() : undefined;
    const displayOrder = req.body.displayOrder ? Number(req.body.displayOrder) : 0;

    const createdMediaItems = await createMultipleGalleryMedia(files, caption, displayOrder);

    res.status(201).json({
      success: true,
      message: `${createdMediaItems.length} media file(s) uploaded to gallery successfully.`,
      data: createdMediaItems.length === 1 ? createdMediaItems[0] : createdMediaItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/gallery/:id
 * Admin: Update media caption or display order.
 */
export const updateGalleryImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Gallery ID is required."));
    }

    const parsed = updateGallerySchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const item = await updateGalleryImage(id, parsed.data);

    res.status(200).json({
      success: true,
      message: "Gallery item updated successfully.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/gallery/:id
 * Admin: Delete image/video from Cloudinary and DB.
 */
export const deleteGalleryImageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Gallery ID is required."));
    }

    const item = await deleteGalleryImage(id);

    res.status(200).json({
      success: true,
      message: "Gallery media item deleted successfully.",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/gallery/reorder
 * Admin: Reorder multiple gallery media items.
 */
export const reorderGalleryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = reorderGallerySchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const updatedList = await reorderGalleryImages(parsed.data.orders);

    res.status(200).json({
      success: true,
      message: "Gallery items reordered successfully.",
      data: updatedList,
    });
  } catch (error) {
    next(error);
  }
};
