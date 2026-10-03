import { Request, Response, NextFunction } from "express";
import {
  createPermanentBookingPlan,
  getCustomerPermanentBookings,
  getAllPermanentBookingsForAdmin,
  cancelPermanentBookingPlan,
  updatePermanentBookingDiscount,
} from "./permanentBooking.service";
import {
  createPermanentBookingSchema,
  updatePlanDiscountSchema,
} from "./permanentBooking.validation";
import CustomError from "../../helpers/CustomError";

/**
 * POST /api/v1/permanent-bookings
 * Customer: Create a new 3-month commitment permanent booking plan.
 */
export const createPermanentBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Customer authentication required"));
    }

    const parsed = createPermanentBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const plan = await createPermanentBookingPlan(
      String(req.customer._id),
      parsed.data,
    );

    res.status(201).json({
      success: true,
      message: "Permanent booking plan created and weekly slots reserved successfully.",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/permanent-bookings/me
 * Customer: Get current logged in customer's permanent booking plans.
 */
export const getCustomerPermanentBookingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Customer authentication required"));
    }

    const plans = await getCustomerPermanentBookings(String(req.customer._id));

    res.status(200).json({
      success: true,
      message: "Customer permanent booking plans fetched successfully.",
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/permanent-bookings
 * Admin: Get all permanent booking plans in system with filters.
 */
export const getAdminPermanentBookingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, groundId, page, limit } = req.query;

    const queryFilter: { status?: string; groundId?: string; page?: number; limit?: number } = {};
    if (status) queryFilter.status = String(status);
    if (groundId) queryFilter.groundId = String(groundId);
    if (page) queryFilter.page = Number(page);
    if (limit) queryFilter.limit = Number(limit);

    const result = await getAllPermanentBookingsForAdmin(queryFilter);

    res.status(200).json({
      success: true,
      message: "Permanent booking plans fetched successfully.",
      data: result.plans,
      meta: {
        total: result.total,
        page: queryFilter.page || 1,
        limit: queryFilter.limit || 50,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/permanent-bookings/:id/cancel
 * Admin / Customer: Cancel a permanent booking plan.
 */
export const cancelPermanentBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Permanent booking ID is required."));
    }

    const actorId = req.admin?._id
      ? String(req.admin._id)
      : req.customer?._id
      ? String(req.customer._id)
      : undefined;

    const actorRole = req.admin?._id ? "admin" : "customer";

    const plan = await cancelPermanentBookingPlan(id, actorId, actorRole);

    res.status(200).json({
      success: true,
      message: "Permanent booking plan cancelled successfully.",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/permanent-bookings/:id/discount
 * Admin: Set custom discount for a permanent booking plan.
 */
export const updatePermanentBookingDiscountHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Permanent booking ID is required."));
    }

    const parsed = updatePlanDiscountSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const plan = await updatePermanentBookingDiscount(
      id,
      parsed.data,
      req.admin?._id ? String(req.admin._id) : undefined,
    );

    res.status(200).json({
      success: true,
      message: "Permanent booking discount updated successfully.",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};
