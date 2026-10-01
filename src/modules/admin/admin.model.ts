import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IAdminUser } from "./admin.interface";
import config from "../../config";

const adminUserSchema = new Schema<IAdminUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name must be at most 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
      match: [/^01[3-9]\d{8}$/, "Phone must be a valid Bangladeshi number (e.g. 01712345678)"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Email must be a valid email address"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "staff"],
      default: "admin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

adminUserSchema.index({ phone: 1 }, { unique: true });
adminUserSchema.index({ email: 1 }, { unique: true, sparse: true });

// Hash password before save
adminUserSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) return;
  const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
adminUserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const AdminUser = mongoose.model<IAdminUser>("AdminUser", adminUserSchema);

export default AdminUser;
