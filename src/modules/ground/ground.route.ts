import { Router } from "express";
import {
  getSlots,
  getGroundSettings,
  createGroundHandler,
  updateGroundSettingsHandler,
} from "./ground.controller";
import { adminAuthGuard, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/slots?date=YYYY-MM-DD
 * Returns all time slots for the active ground on a given date.
 * Slot status (available/unavailable) and price (with 48h discount) are computed on read.
 * No auth required.
 */
router.get("/slots", getSlots);

// ── Admin ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ground/settings
 * Returns the full ground settings document.
 * Requires admin authentication.
 */
router.get(
  "/ground/settings",
  adminAuthGuard,
  getGroundSettings,
);

/**
 * POST /api/v1/ground
 * Creates the ground record (one-time setup).
 * Requires super_admin role.
 */
router.post(
  "/ground",
  adminAuthGuard,
  requireRole("super_admin"),
  createGroundHandler,
);

/**
 * PATCH /api/v1/ground/settings/:id
 * Updates ground settings and/or closure dates.
 * Requires super_admin role.
 */
router.patch(
  "/ground/settings/:id",
  adminAuthGuard,
  requireRole("super_admin"),
  updateGroundSettingsHandler,
);

export default router;
