import { Document, Types } from "mongoose";

export type AdminRole = "super_admin" | "admin" | "staff";

export interface IAdminUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type CreateAdminInput = {
  name: string;
  phone: string;
  password: string;
  role: AdminRole;
};

export type UpdateAdminInput = {
  name?: string;
  phone?: string;
  password?: string;
  role?: AdminRole;
  isActive?: boolean;
};
