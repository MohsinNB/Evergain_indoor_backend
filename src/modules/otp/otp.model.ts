import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IOTP } from "./otp.interface";
import config from "../../config";

const otpSchema = new Schema<IOTP>(
  {
    phone: {
      type: String,
      trim: true,
      match: [/^01[3-9]\d{8}$/, "Phone must be a valid Bangladeshi number"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email must be a valid email address"],
    },
    channel: {
      type: String,
      enum: ["sms", "email"],
      default: "sms",
      required: true,
    },
    otpHash: {
      type: String,
      required: [true, "OTP hash is required"],
      select: false,
    },
    purpose: {
      type: String,
      enum: ["signup", "login", "reset_password", "booking_verification"],
      default: "signup",
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// 5-minute TTL auto-expiry index
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, purpose: 1 });
otpSchema.index({ email: 1, purpose: 1 });

// Hash OTP before save
otpSchema.pre("save", async function () {
  if (!this.isModified("otpHash")) return;
  const salt = await bcrypt.genSalt(config.bcryptSaltRounds);
  this.otpHash = await bcrypt.hash(this.otpHash, salt);
});

// Compare OTP method
otpSchema.methods.compareOTP = async function (candidateOTP: string): Promise<boolean> {
  return bcrypt.compare(candidateOTP, this.otpHash);
};

const OTP = mongoose.model<IOTP>("OTP", otpSchema);

export default OTP;
