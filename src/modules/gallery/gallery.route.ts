import { Router } from "express";
import {
  getGalleryHandler,
  uploadGalleryImageHandler,
  updateGalleryImageHandler,
  deleteGalleryImageHandler,
  reorderGalleryHandler,
} from "./gallery.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";
import { uploadMultipleMedia } from "../../middleware/upload.middleware";

const router = Router();

// ── Public Gallery Routes ───────────────────────────────────────────────────

/**
 * GET /api/v1/gallery
 * Public: List gallery images & videos ordered by displayOrder & uploadedAt.
 */
router.get("/gallery", getGalleryHandler);

// ── Admin Protected Gallery Routes ──────────────────────────────────────────

/**
 * POST /api/v1/gallery/upload
 * Admin: Upload single or multiple images/videos to Cloudinary and add to gallery.
 */
router.post(
  "/gallery/upload",
  adminAuthGuard,
  uploadMultipleMedia,
  uploadGalleryImageHandler,
);

/**
 * PATCH /api/v1/gallery/reorder
 * Admin: Reorder multiple gallery media items.
 */
router.patch(
  "/gallery/reorder",
  adminAuthGuard,
  reorderGalleryHandler,
);

/**
 * PATCH /api/v1/gallery/:id
 * Admin: Update media caption or display order.
 */
router.patch(
  "/gallery/:id",
  adminAuthGuard,
  updateGalleryImageHandler,
);

/**
 * DELETE /api/v1/gallery/:id
 * Admin: Delete image/video from Cloudinary and DB.
 */
router.delete(
  "/gallery/:id",
  adminAuthGuard,
  deleteGalleryImageHandler,
);

export default router;
