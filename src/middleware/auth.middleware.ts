import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import CustomError from "../helpers/CustomError";

interface AdminTokenPayload extends JwtPayload {
  adminId: string;
  role: "super_admin" | "admin" | "staff";
  phone: string;
}

interface CustomerTokenPayload extends JwtPayload {
  customerId: string;
  phone: string;
}

/**
 * Protects admin routes.
 * Reads JWT from httpOnly cookie: adminToken
 */
export const adminAuthGuard = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.adminToken ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : undefined);

    if (!token) {
      throw new CustomError(401, "Not authenticated. Please login.");
    }

    const decoded = jwt.verify(
      token,
      config.jwt.adminSecret,
    ) as AdminTokenPayload;

    if (!decoded || !decoded.adminId) {
      throw new CustomError(401, "Invalid or expired session. Please login again.");
    }

    req.admin = {
      _id: decoded.adminId,
      phone: decoded.phone,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * RBAC for admin routes.
 * Use after adminAuthGuard.
 * @example router.patch("/settings", adminAuthGuard, requireRole("super_admin"), ...)
 */
export const requireRole = (...roles: Array<"super_admin" | "admin" | "staff">) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin?.role) {
      return next(new CustomError(403, "Forbidden."));
    }
    if (!roles.includes(req.admin.role)) {
      return next(
        new CustomError(403, "You do not have permission to perform this action."),
      );
    }
    next();
  };
};

/**
 * Protects customer routes (registered customers only).
 * Reads JWT from httpOnly cookie: customerToken OR Authorization: Bearer <token>
 */
export const customerAuthGuard = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.customerToken ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : undefined);

    if (!token) {
      throw new CustomError(401, "Not authenticated. Please login.");
    }

    const decoded = jwt.verify(
      token,
      config.jwt.customerSecret,
    ) as CustomerTokenPayload;

    if (!decoded || !decoded.customerId) {
      throw new CustomError(401, "Invalid or expired session. Please login again.");
    }

    req.customer = {
      _id: decoded.customerId,
      phone: decoded.phone,
    };

    next();
  } catch (error) {
    next(error);
  }
};
