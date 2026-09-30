import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { ICustomer } from "./customer.interface";
import config from "../../config";

const customerSchema = new Schema<ICustomer>(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^01[3-9]\d{8}$/, "Phone must be a valid Bangladeshi number (e.g. 01712345678)"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name must be at most 100 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "Email must be a valid email address"],
    },
    passwordHash: {
      type: String,
      select: false,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before save if modified
customerSchema.pre("save", async function () {
  if (!this.isModified("passwordHash") || !this.passwordHash) return;
  const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
customerSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const Customer = mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
