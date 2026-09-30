import { Request, Response, NextFunction } from "express";
import { loginAdmin, logoutAdmin } from "./auth.service";
import { adminLoginSchema } from "../admin/admin.validation";
import CustomError from "../../helpers/CustomError";

/**
 * POST /api/v1/auth/admin/login
 */
export const adminLoginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { admin, token } = await loginAdmin(parsed.data, res);

    res.status(200).json({
      success: true,
      message: "Admin logged in successfully.",
      data: {
        admin,
        token, // returned for API / Postman testing convenience
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/admin/logout
 */
export const adminLogoutHandler = (
  _req: Request,
  res: Response,
): void => {
  logoutAdmin(res);
  res.status(200).json({
    success: true,
    message: "Admin logged out successfully.",
  });
};

/**
 * GET /api/v1/auth/admin/me
 */
export const adminMeHandler = (
  req: Request,
  res: Response,
): void => {
  res.status(200).json({
    success: true,
    message: "Current admin profile fetched.",
    data: req.admin,
  });
};
