import { Router } from "express";
import {
  createGuestBookingRequestHandler,
  createAdminManualBookingHandler,
  getAdminBookingsHandler,
  getBookingByIdHandler,
  cancelBookingHandler,
  noShowBookingHandler,
  revertBookingToBookedHandler,
  getPublicBookingReceiptHandler,
  getMyCustomerBookingsHandler,
  getMonthlyCalendarOverviewHandler,
} from "./booking.controller";
import { adminAuthGuard, customerAuthGuard } from "../../middleware/auth.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// ── Public Guest Booking Routes ──────────────────────────────────────────────

/**
 * POST /api/v1/bookings/request
 * Public: Guest booking request (15-min hold, 48h discount, SSLCommerz checkout session).
 */
router.post(
  "/bookings/request",
  rateLimiter(10, 15 * 60 * 1000), // Max 10 requests per 15 min per IP
  createGuestBookingRequestHandler,
);

/**
 * GET /api/v1/bookings/public-receipt/:identifier
 * Public: Fetch booking receipt details by ID or transaction ID.
 */
router.get(
  "/bookings/public-receipt/:identifier",
  getPublicBookingReceiptHandler,
);

// ── Customer Protected Routes ───────────────────────────────────────────────

/**
 * GET /api/v1/bookings/me
 * Customer: Fetch current customer's booking history.
 */
router.get(
  "/bookings/me",
  customerAuthGuard,
  getMyCustomerBookingsHandler,
);

// ── Admin Protected Booking Routes ─────────────────────────────────────────

/**
 * GET /api/v1/calendar
 * Admin: Get monthly calendar overview of slot availability and revenue.
 */
router.get(
  "/calendar",
  adminAuthGuard,
  getMonthlyCalendarOverviewHandler,
);

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

/**
 * PATCH /api/v1/bookings/:id/revert-booked
 * Admin: Revert NO_SHOW or CANCELLED booking back to BOOKED.
 */
router.patch(
  "/bookings/:id/revert-booked",
  adminAuthGuard,
  revertBookingToBookedHandler,
);

export default router;
