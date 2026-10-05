import { Request, Response, NextFunction } from "express";
import { registerCustomer, loginCustomer, logoutCustomer, resetCustomerPassword } from "./customerAuth.service";
import { customerSignupSchema, customerLoginSchema, customerResetPasswordSchema } from "../customer/customer.validation";
import Customer from "../customer/customer.model";
import CustomError from "../../helpers/CustomError";

/**
 * POST /api/v1/auth/customer/signup
 */
export const customerSignupHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = customerSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { customer, token } = await registerCustomer(parsed.data, res);

    res.status(201).json({
      success: true,
      message: "Customer registered successfully.",
      data: {
        customer,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/customer/login
 */
export const customerLoginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = customerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { customer, token } = await loginCustomer(parsed.data, res);

    res.status(200).json({
      success: true,
      message: "Customer logged in successfully.",
      data: {
        customer,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/customer/logout
 */
export const customerLogoutHandler = (
  _req: Request,
  res: Response,
): void => {
  logoutCustomer(res);
  res.status(200).json({
    success: true,
    message: "Customer logged out successfully.",
  });
};

/**
 * GET /api/v1/auth/customer/me
 */
export const customerMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.customer?._id) {
      return next(new CustomError(401, "Not authenticated"));
    }

    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(new CustomError(404, "Customer not found"));
    }

    res.status(200).json({
      success: true,
      message: "Current customer profile fetched.",
      data: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        isRegistered: customer.isRegistered,
        totalBookings: customer.totalBookings,
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/customer/reset-password
 */
export const customerResetPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = customerResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const result = await resetCustomerPassword(parsed.data);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
