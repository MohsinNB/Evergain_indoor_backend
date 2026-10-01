import AdminUser from "./admin.model";
import { IAdminUser } from "./admin.interface";
import { CreateAdminZodInput, UpdateAdminZodInput } from "./admin.validation";
import config from "../../config";
import CustomError from "../../helpers/CustomError";
import chalk from "chalk";

/**
 * Automatically seeds initial super_admin users from config/env on DB connection.
 * Idempotent: checks by email/phone before creating.
 */
export const seedSuperAdminsFromConfig = async (): Promise<void> => {
  const superAdminEmails = config.superAdmin.emails;
  const defaultPassword = config.superAdmin.defaultPassword;

  if (!superAdminEmails || superAdminEmails.length === 0) {
    return;
  }

  for (let i = 0; i < superAdminEmails.length; i++) {
    const email = superAdminEmails[i];
    if (!email) continue;

    const defaultPhone = `0170000000${i + 1}`;

    const existingAdmin = await AdminUser.findOne({
      $or: [{ email }, { phone: defaultPhone }],
    });

    if (!existingAdmin) {
      await AdminUser.create({
        name: `Super Admin ${i + 1}`,
        email,
        phone: defaultPhone,
        passwordHash: defaultPassword,
        role: "super_admin",
        isActive: true,
      });
      console.log(chalk.green(`[Auto-Seed] Super Admin created for email: ${email}`));
    }
  }
};

/**
 * Create new admin/staff user (super_admin only).
 */
export const createAdminUser = async (data: CreateAdminZodInput): Promise<IAdminUser> => {
  const existingPhone = await AdminUser.findOne({ phone: data.phone });
  if (existingPhone) {
    throw new CustomError(400, "An admin user with this phone number already exists.");
  }

  if (data.email) {
    const existingEmail = await AdminUser.findOne({ email: data.email.toLowerCase().trim() });
    if (existingEmail) {
      throw new CustomError(400, "An admin user with this email address already exists.");
    }
  }

  const createPayload: Record<string, any> = {
    name: data.name,
    phone: data.phone,
    passwordHash: data.password,
    role: data.role,
    isActive: true,
  };
  if (data.email) {
    createPayload["email"] = data.email.toLowerCase().trim();
  }

  const newAdmin = await AdminUser.create(createPayload);
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
  if (data.email !== undefined) {
    const existing = await AdminUser.findOne({ email: data.email.toLowerCase().trim(), _id: { $ne: id } });
    if (existing) {
      throw new CustomError(400, "Another admin user with this email address already exists.");
    }
    admin.email = data.email.toLowerCase().trim();
  }
  if (data.password !== undefined) {
    admin.passwordHash = data.password;
  }
  if (data.role !== undefined) admin.role = data.role;
  if (data.isActive !== undefined) admin.isActive = data.isActive;

  await admin.save();
  return admin;
};
