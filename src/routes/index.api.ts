import express from "express";

const router = express.Router();

/**
 * API Routes — Evergain Avenue
 *
 * Modules will be mounted here as they are built.
 * Build order per AGENTS.md section 11:
 *   1. ground        → GET /slots, GET|PATCH /ground/settings
 *   2. booking       → POST /bookings/request, GET /bookings (admin)
 *   3. payment       → POST /payment/sslcommerz/ipn|success|fail|cancel
 *   4. gallery       → GET /gallery, POST /gallery/upload (admin)
 *   5. customerAuth  → POST /auth/customer/signup|login
 *   6. customer      → profile, discount coupon
 *   7. analytics     → GET /analytics/daily|monthly|yearly
 *   8. auditLog      → GET /audit-logs
 *   9. permanentBooking → POST /permanent-bookings
 *  10. auth (admin)  → POST /auth/admin/login
 *  11. admin mgmt    → GET|POST|PATCH /admins
 */

// ── Module 1: Ground + Slot Availability ──────────────────────────────────
import groundRoutes from "../modules/ground/ground.route";
router.use("/", groundRoutes);

// ── Admin Management & Auth ───────────────────────────────────────────────
import adminRoutes from "../modules/admin/admin.route";
import adminAuthRoutes from "../modules/auth/auth.route";
router.use("/", adminRoutes);
router.use("/", adminAuthRoutes);

// ── Module 2: Booking Management (Admin Manual Booking / Block Slot) ──────
import bookingRoutes from "../modules/booking/booking.route";
router.use("/", bookingRoutes);

// ── Customer Auth & Profile ───────────────────────────────────────────────
import customerAuthRoutes from "../modules/customerAuth/customerAuth.route";
import customerRoutes from "../modules/customer/customer.route";
router.use("/", customerAuthRoutes);
router.use("/", customerRoutes);

export default router;
