import { Router } from "express";
import {
  getPublicGroundsHandler,
  getSlots,
  getGroundSettings,
  createGroundHandler,
  updateGroundSettingsHandler,
} from "./ground.controller";
import { adminAuthGuard, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// Public routes: Get all active grounds, Get slots for a specific ground and date
router.get("/grounds", getPublicGroundsHandler);
router.get("/slots", getSlots);

// Admin routes: Ground settings & creation
router.get("/ground/settings", adminAuthGuard, getGroundSettings);
router.post(
  "/ground",
  adminAuthGuard,
  requireRole("super_admin", "admin"),
  createGroundHandler,
);
router.patch(
  "/ground/settings/:id",
  adminAuthGuard,
  requireRole("super_admin"),
  updateGroundSettingsHandler,
);

export default router;
