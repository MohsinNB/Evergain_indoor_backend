import jwt from "jsonwebtoken";
import { Response } from "express";
import AdminUser from "../admin/admin.model";
import { IAdminUser } from "../admin/admin.interface";
import { AdminLoginZodInput } from "../admin/admin.validation";
import config from "../../config";
import CustomError from "../../helpers/CustomError";

/**
 * Login admin user and generate admin JWT.
 */
export const loginAdmin = async (
  data: AdminLoginZodInput,
  res: Response,
): Promise<{ admin: Partial<IAdminUser>; token: string }> => {
  const admin = await AdminUser.findOne({ phone: data.phone }).select("+passwordHash");
  if (!admin) {
    throw new CustomError(401, "Invalid phone number or password.");
  }

  if (!admin.isActive) {
    throw new CustomError(403, "Your account has been deactivated. Please contact super admin.");
  }

  const isMatch = await admin.comparePassword(data.password);
  if (!isMatch) {
    throw new CustomError(401, "Invalid phone number or password.");
  }

  // Generate Admin JWT
  const token = jwt.sign(
    {
      adminId: String(admin._id),
      role: admin.role,
      phone: admin.phone,
    },
    config.jwt.adminSecret,
    {
      expiresIn: config.jwt.adminExpire as any,
    },
  );

  // Set httpOnly cookie
  res.cookie("adminToken", token, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  return {
    admin: {
      _id: admin._id,
      name: admin.name,
      phone: admin.phone,
      role: admin.role,
      isActive: admin.isActive,
    },
    token,
  };
};

/**
 * Logout admin user by clearing cookie.
 */
export const logoutAdmin = (res: Response): void => {
  res.clearCookie("adminToken", {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
  });
};
