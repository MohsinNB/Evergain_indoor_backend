import { Router } from "express";
import {
  getDailyAnalyticsHandler,
  getMonthlyAnalyticsHandler,
  getYearlyAnalyticsHandler,
} from "./analytics.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

// Admin Analytics Protected Routes

/**
 * GET /api/v1/analytics/daily?date=YYYY-MM-DD
 */
router.get("/analytics/daily", adminAuthGuard, getDailyAnalyticsHandler);

/**
 * GET /api/v1/analytics/monthly?year=YYYY&month=MM
 */
router.get("/analytics/monthly", adminAuthGuard, getMonthlyAnalyticsHandler);

/**
 * GET /api/v1/analytics/yearly?year=YYYY
 */
router.get("/analytics/yearly", adminAuthGuard, getYearlyAnalyticsHandler);

export default router;
