import { Router } from "express";
import {
  createPermanentBookingHandler,
  getCustomerPermanentBookingsHandler,
  getAdminPermanentBookingsHandler,
  cancelPermanentBookingHandler,
  updatePermanentBookingDiscountHandler,
} from "./permanentBooking.controller";
import { customerAuthGuard, adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

// ── Customer Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/permanent-bookings
 * Customer: Create a 3-month commitment permanent booking plan.
 */
router.post(
  "/permanent-bookings",
  customerAuthGuard,
  createPermanentBookingHandler,
);

/**
 * GET /api/v1/permanent-bookings/me
 * Customer: View customer's active permanent booking plans.
 */
router.get(
  "/permanent-bookings/me",
  customerAuthGuard,
  getCustomerPermanentBookingsHandler,
);

// ── Admin Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/permanent-bookings
 * Admin: List all permanent booking plans.
 */
router.get(
  "/permanent-bookings",
  adminAuthGuard,
  getAdminPermanentBookingsHandler,
);

/**
 * PATCH /api/v1/permanent-bookings/:id/discount
 * Admin: Update discount for a permanent booking plan.
 */
router.patch(
  "/permanent-bookings/:id/discount",
  adminAuthGuard,
  updatePermanentBookingDiscountHandler,
);

/**
 * PATCH /api/v1/permanent-bookings/:id/cancel
 * Admin / Customer: Cancel permanent booking plan.
 */
router.patch(
  "/permanent-bookings/:id/cancel",
  cancelPermanentBookingHandler,
);

export default router;
