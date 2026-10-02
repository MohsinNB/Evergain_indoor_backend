import { Request, Response, NextFunction } from "express";
import {
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerCoupons,
  getAllCustomersForAdmin,
} from "./customer.service";
import { updateCustomerProfileSchema } from "./customer.validation";
import CustomError from "../../helpers/CustomError";

/**
 * GET /api/v1/customer/profile
 */
export const getProfileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Not authenticated"));
    }

    const customer = await getCustomerProfile(String(req.customer._id));

    res.status(200).json({
      success: true,
      message: "Customer profile fetched successfully.",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/customer/profile
 */
export const updateProfileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Not authenticated"));
    }

    const parsed = updateCustomerProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { customer, couponAwarded } = await updateCustomerProfile(
      String(req.customer._id),
      parsed.data,
    );

    res.status(200).json({
      success: true,
      message: couponAwarded
        ? "Profile updated! You unlocked ৳50 off your next booking."
        : "Profile updated successfully.",
      data: {
        customer,
        couponAwarded,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/customer/coupons
 */
export const getCouponsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Not authenticated"));
    }

    const coupons = await getCustomerCoupons(String(req.customer._id));

    res.status(200).json({
      success: true,
      message: "Customer coupons fetched successfully.",
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/customers (Admin Only)
 * List all customers (registered and guest) with search and pagination.
 */
export const getCustomersForAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { search, isRegistered, page, limit } = req.query;

    const queryFilter: { search?: string; isRegistered?: boolean; page?: number; limit?: number } = {};
    if (search) queryFilter.search = String(search);
    if (isRegistered !== undefined) queryFilter.isRegistered = isRegistered === "true";
    if (page) queryFilter.page = Number(page);
    if (limit) queryFilter.limit = Number(limit);

    const result = await getAllCustomersForAdmin(queryFilter);

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully.",
      data: result.customers,
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
