import { Request, Response, NextFunction } from "express";
import {
  createGuestBookingRequest,
  createAdminManualBooking,
  getAdminBookings,
  getBookingById,
  cancelBookingByAdmin,
  markBookingNoShow,
  revertBookingToBooked,
  getPublicBookingReceipt,
  getMyCustomerBookings,
  getMonthlyCalendarOverview,
} from "./booking.service";
import {
  createBookingRequestSchema,
  createAdminManualBookingSchema,
  cancelBookingSchema,
} from "./booking.validation";
import CustomError from "../../helpers/CustomError";


/**
 * POST /api/v1/bookings/request
 * Public: Guest booking request with 15-min hold & SSLCommerz checkout session initiation.
 */
export const createGuestBookingRequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createBookingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const hostHeader = req.get("host") || undefined;
    const result = await createGuestBookingRequest(parsed.data, hostHeader);

    res.status(201).json({
      success: true,
      message: "Booking request created successfully. 15-minute hold active.",
      data: {
        bookingId: result.booking._id,
        tranId: result.tranId,
        price: result.booking.price,
        appliedDiscount: result.booking.appliedDiscount,
        holdExpiresAt: result.holdExpiresAt,
        gatewayUrl: result.gatewayUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

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

    const adminId = req.admin?._id ? String(req.admin._id) : undefined;
    const booking = await cancelBookingByAdmin(id, parsed.data.cancelReason, adminId);

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

    const adminId = req.admin?._id ? String(req.admin._id) : undefined;
    const booking = await markBookingNoShow(id, adminId);

    res.status(200).json({
      success: true,
      message: "Booking marked as NO_SHOW.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/bookings/:id/revert-booked
 * Admin: Revert NO_SHOW or CANCELLED booking back to BOOKED.
 */
export const revertBookingToBookedHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Booking ID is required."));
    }

    const adminId = req.admin?._id ? String(req.admin._id) : undefined;
    const booking = await revertBookingToBooked(id, adminId);

    res.status(200).json({
      success: true,
      message: "Booking reverted to BOOKED (active) successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bookings/public-receipt/:identifier
 * Public: Get booking receipt details by ID or Transaction ID.
 */
export const getPublicBookingReceiptHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const identifier = String(req.params["identifier"] ?? "").trim();
    if (!identifier) {
      return next(new CustomError(400, "Booking ID or Transaction ID is required."));
    }

    const booking = await getPublicBookingReceipt(identifier);

    res.status(200).json({
      success: true,
      message: "Booking receipt fetched successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bookings/me
 * Customer: Get current customer's booking history.
 */
export const getMyCustomerBookingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id || !req.customer?.phone) {
      return next(new CustomError(401, "Customer authentication required."));
    }

    const bookings = await getMyCustomerBookings(
      String(req.customer._id),
      req.customer.phone,
    );

    res.status(200).json({
      success: true,
      message: "Customer booking history fetched successfully.",
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/calendar?month=YYYY-MM
 * Admin: Get monthly calendar overview of slots and revenue.
 */
export const getMonthlyCalendarOverviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const month = String(req.query["month"] ?? "").trim();
    const groundId = req.query["groundId"] ? String(req.query["groundId"]).trim() : undefined;

    if (!month) {
      return next(new CustomError(400, "Month parameter (YYYY-MM) is required."));
    }

    const result = await getMonthlyCalendarOverview(month, groundId);

    res.status(200).json({
      success: true,
      message: "Monthly calendar fetched successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
