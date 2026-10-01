import { Request, Response, NextFunction } from "express";
import {
  createAdminUser,
  getAllAdmins,
  getAdminById,
  updateAdminUser,
} from "./admin.service";
import { createAdminSchema, updateAdminSchema } from "./admin.validation";
import CustomError from "../../helpers/CustomError";

/**
 * GET /api/v1/admins
 * List all admin users (super_admin only).
 */
export const getAdminsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const admins = await getAllAdmins();
    res.status(200).json({
      success: true,
      message: "Admin users fetched successfully.",
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admins
 * Create new admin/staff (super_admin only).
 */
export const createAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const admin = await createAdminUser(parsed.data);

    res.status(201).json({
      success: true,
      message: "Admin user created successfully.",
      data: {
        _id: admin._id,
        name: admin.name,
        phone: admin.phone,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admins/:id
 * Update admin user role, status, or details (super_admin only).
 */
export const updateAdminHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Admin ID is required."));
    }

    const parsed = updateAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const updated = await updateAdminUser(id, parsed.data);

    res.status(200).json({
      success: true,
      message: "Admin user updated successfully.",
      data: {
        _id: updated._id,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};
