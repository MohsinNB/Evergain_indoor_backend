import { Request, Response, NextFunction } from "express";
import {
  createAdminManualBooking,
  getAdminBookings,
  getBookingById,
  cancelBookingByAdmin,
  markBookingNoShow,
} from "./booking.service";
import {
  createAdminManualBookingSchema,
  cancelBookingSchema,
} from "./booking.validation";
import CustomError from "../../helpers/CustomError";

/**
 * POST /api/v1/bookings/admin-manual
 * Admin: Manually book / block a slot for an offline customer or maintenance.
 * Traces bookedByAdminId for financial auditing.
 */
export const createAdminManualBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.admin?._id) {
      return next(new CustomError(401, "Admin authentication required"));
    }

    const parsed = createAdminManualBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const booking = await createAdminManualBooking(
      String(req.admin._id),
      parsed.data,
    );

    res.status(201).json({
      success: true,
      message: "Slot successfully booked/blocked by admin.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bookings
 * Admin: List all bookings with optional query filters (date, status, groundId).
 */
export const getAdminBookingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { date, status, groundId, page, limit } = req.query;

    const queryFilter: { date?: string; status?: string; groundId?: string; page?: number; limit?: number } = {};
    if (date) queryFilter.date = String(date);
    if (status) queryFilter.status = String(status);
    if (groundId) queryFilter.groundId = String(groundId);
    if (page) queryFilter.page = Number(page);
    if (limit) queryFilter.limit = Number(limit);

    const result = await getAdminBookings(queryFilter);

    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully.",
      data: result.bookings,
      meta: {
        total: result.total,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bookings/:id
 * Admin: Get single booking details.
 */
export const getBookingByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Booking ID is required."));
    }

    const booking = await getBookingById(id);

    res.status(200).json({
      success: true,
      message: "Booking details fetched successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/bookings/:id/cancel
 * Admin: Cancel a booking.
 */
export const cancelBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Booking ID is required."));
    }

    const parsed = cancelBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const booking = await cancelBookingByAdmin(id, parsed.data.cancelReason);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully. Slot is now available.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/bookings/:id/no-show
 * Admin: Mark booking as NO_SHOW.
 */
export const noShowBookingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Booking ID is required."));
    }

    const booking = await markBookingNoShow(id);

    res.status(200).json({
      success: true,
      message: "Booking marked as NO_SHOW.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};
