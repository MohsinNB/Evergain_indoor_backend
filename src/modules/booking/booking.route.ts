import { Router } from "express";
import {
  createAdminManualBookingHandler,
  getAdminBookingsHandler,
  getBookingByIdHandler,
  cancelBookingHandler,
  noShowBookingHandler,
} from "./booking.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

// ── Admin Protected Booking Routes ─────────────────────────────────────────

/**
 * POST /api/v1/bookings/admin-manual
 * Admin: Manually book / block a slot for an offline customer.
 */
router.post(
  "/bookings/admin-manual",
  adminAuthGuard,
  createAdminManualBookingHandler,
);

/**
 * GET /api/v1/bookings
 * Admin: List all bookings with filters.
 */
router.get(
  "/bookings",
  adminAuthGuard,
  getAdminBookingsHandler,
);

/**
 * GET /api/v1/bookings/:id
 * Admin: Get single booking details.
 */
router.get(
  "/bookings/:id",
  adminAuthGuard,
  getBookingByIdHandler,
);

/**
 * PATCH /api/v1/bookings/:id/cancel
 * Admin: Cancel booking.
 */
router.patch(
  "/bookings/:id/cancel",
  adminAuthGuard,
  cancelBookingHandler,
);

/**
 * PATCH /api/v1/bookings/:id/no-show
 * Admin: Mark booking as NO_SHOW.
 */
router.patch(
  "/bookings/:id/no-show",
  adminAuthGuard,
  noShowBookingHandler,
);

export default router;
