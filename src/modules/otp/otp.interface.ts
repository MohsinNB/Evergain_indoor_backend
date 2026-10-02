import { Document, Types } from "mongoose";

export type OTPPurpose =
  | "signup"
  | "login"
  | "reset_password"
  | "booking_verification";

export type OTPChannel = "sms" | "email";

export interface IOTP extends Document {
  _id: Types.ObjectId;
  phone?: string;
  email?: string;
  channel: OTPChannel;
  otpHash: string;
  purpose: OTPPurpose;
  attempts: number;
  isVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  compareOTP(candidateOTP: string): Promise<boolean>;
}

export type SendOTPInput = {
  channel?: OTPChannel;
  phone?: string;
  email?: string;
  purpose?: OTPPurpose;
};

export type VerifyOTPInput = {
  channel?: OTPChannel;
  phone?: string;
  email?: string;
  otp: string;
  purpose?: OTPPurpose;
};
