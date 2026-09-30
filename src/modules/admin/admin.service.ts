import AdminUser from "./admin.model";
import { IAdminUser } from "./admin.interface";
import { CreateAdminZodInput, UpdateAdminZodInput, SeedAdminZodInput } from "./admin.validation";
import CustomError from "../../helpers/CustomError";

/**
 * Seed initial super_admin if no admin exists in the system.
 */
export const seedInitialSuperAdmin = async (data: SeedAdminZodInput): Promise<IAdminUser> => {
  const count = await AdminUser.countDocuments();
  if (count > 0) {
    throw new CustomError(400, "Super admin already seeded. An admin account already exists.");
  }

  const superAdmin = await AdminUser.create({
    name: data.name,
    phone: data.phone,
    passwordHash: data.password,
    role: "super_admin",
    isActive: true,
  });

  return superAdmin;
};

/**
 * Create new admin/staff user (super_admin only).
 */
export const createAdminUser = async (data: CreateAdminZodInput): Promise<IAdminUser> => {
  const existing = await AdminUser.findOne({ phone: data.phone });
  if (existing) {
    throw new CustomError(400, "An admin user with this phone number already exists.");
  }

  const newAdmin = await AdminUser.create({
    name: data.name,
    phone: data.phone,
    passwordHash: data.password,
    role: data.role,
    isActive: true,
  });

  return newAdmin;
};

/**
 * Get list of all admin users.
 */
export const getAllAdmins = async (): Promise<IAdminUser[]> => {
  return AdminUser.find().select("-passwordHash").sort({ createdAt: -1 });
};

/**
 * Get single admin user by ID.
 */
export const getAdminById = async (id: string): Promise<IAdminUser> => {
  const admin = await AdminUser.findById(id).select("-passwordHash");
  if (!admin) {
    throw new CustomError(404, "Admin user not found.");
  }
  return admin;
};

/**
 * Update admin user details.
 */
export const updateAdminUser = async (
  id: string,
  data: UpdateAdminZodInput,
): Promise<IAdminUser> => {
  const admin = await AdminUser.findById(id);
  if (!admin) {
    throw new CustomError(404, "Admin user not found.");
  }

  if (data.name !== undefined) admin.name = data.name;
  if (data.phone !== undefined) {
    const existing = await AdminUser.findOne({ phone: data.phone, _id: { $ne: id } });
    if (existing) {
      throw new CustomError(400, "Another admin user with this phone number already exists.");
    }
    admin.phone = data.phone;
  }
  if (data.password !== undefined) {
    admin.passwordHash = data.password;
  }
  if (data.role !== undefined) admin.role = data.role;
  if (data.isActive !== undefined) admin.isActive = data.isActive;

  await admin.save();
  return admin;
};
