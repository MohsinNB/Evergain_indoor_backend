import { Request, Response, NextFunction } from "express";
import {
  getDailyAnalytics,
  getMonthlyAnalytics,
  getYearlyAnalytics,
} from "./analytics.service";

/**
 * GET /api/v1/analytics/daily?date=YYYY-MM-DD
 * Admin: Daily revenue, occupancy rate & payment breakdown.
 */
export const getDailyAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dateParam = req.query.date ? String(req.query.date) : undefined;
    const data = await getDailyAnalytics(dateParam);

    res.status(200).json({
      success: true,
      message: "Daily analytics report fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/monthly?year=YYYY&month=MM
 * Admin: Monthly revenue, daily trend & peak hours.
 */
export const getMonthlyAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    const monthParam = req.query.month ? Number(req.query.month) : undefined;

    const data = await getMonthlyAnalytics(yearParam, monthParam);

    res.status(200).json({
      success: true,
      message: "Monthly analytics report fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/yearly?year=YYYY
 * Admin: Yearly revenue, monthly breakdown & customer metrics.
 */
export const getYearlyAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    const data = await getYearlyAnalytics(yearParam);

    res.status(200).json({
      success: true,
      message: "Yearly analytics report fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};
