import OTP from "./otp.model";
import { SendOTPZodInput, VerifyOTPZodInput } from "./otp.validation";
import { sendSMS } from "../../helpers/sms";
import { sendEmail } from "../../helpers/email";
import CustomError from "../../helpers/CustomError";
import crypto from "crypto";

/**
 * Generates cryptographically secure 6-digit numeric OTP string.
 */
const generate6DigitOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Sends OTP to phone (SMS) or email with 60-second cooldown & 5-minute expiry.
 */
export const sendOTPService = async (
  data: SendOTPZodInput,
): Promise<{ message: string; expiresAt: Date }> => {
  const { channel = "sms", phone, email, purpose } = data;

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  // 60-second cooldown check
  const cooldownFilter: Record<string, any> = {
    purpose,
    createdAt: { $gt: oneMinuteAgo },
  };
  if (channel === "sms" && phone) cooldownFilter["phone"] = phone;
  if (channel === "email" && email) cooldownFilter["email"] = email.toLowerCase().trim();

  const recentOTP = await OTP.findOne(cooldownFilter);
  if (recentOTP) {
    throw new CustomError(
      429,
      "Please wait 60 seconds before requesting another OTP.",
    );
  }

  // Delete previous unverified OTPs for this phone/email + purpose
  const cleanupFilter: Record<string, any> = { purpose, isVerified: false };
  if (channel === "sms" && phone) cleanupFilter["phone"] = phone;
  if (channel === "email" && email) cleanupFilter["email"] = email.toLowerCase().trim();
  await OTP.deleteMany(cleanupFilter);

  const rawOTP = generate6DigitOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  const otpPayload: Record<string, any> = {
    channel,
    otpHash: rawOTP,
    purpose,
    expiresAt,
    isVerified: false,
    attempts: 0,
  };
  if (phone) otpPayload["phone"] = phone;
  if (email) otpPayload["email"] = email.toLowerCase().trim();

  await OTP.create(otpPayload);

  if (channel === "sms" && phone) {
    const smsMessage = `Your Evergain Avenue OTP code is: ${rawOTP}. Valid for 5 minutes. Do not share this code.`;
    await sendSMS(phone, smsMessage);
    return {
      message: `OTP sent successfully via SMS to ${phone}.`,
      expiresAt,
    };
  } else if (channel === "email" && email) {
    const emailSubject = `Evergain Avenue — Your OTP Verification Code [${rawOTP}]`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #10b981; margin-bottom: 10px;">Evergain Avenue Verification</h2>
        <p>Your OTP verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; background: #f1f5f9; padding: 12px 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
          ${rawOTP}
        </div>
        <p style="color: #64748b; font-size: 14px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
      </div>
    `;
    await sendEmail(email.toLowerCase().trim(), emailSubject, emailHtml);
    return {
      message: `OTP sent successfully via Email to ${email}.`,
      expiresAt,
    };
  } else {
    throw new CustomError(400, "Target phone number or email address is missing for the selected channel.");
  }
};

/**
 * Verifies 6-digit OTP code.
 */
export const verifyOTPService = async (
  data: VerifyOTPZodInput,
): Promise<{ success: boolean; message: string }> => {
  const { channel, phone, email, otp, purpose } = data;

  const filter: Record<string, any> = {
    purpose,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  };

  if (channel === "email" && email) {
    filter["email"] = email.toLowerCase().trim();
  } else if (phone) {
    filter["phone"] = phone;
  } else if (email) {
    filter["email"] = email.toLowerCase().trim();
  }

  const otpRecord = await OTP.findOne(filter).select("+otpHash");

  if (!otpRecord) {
    throw new CustomError(
      400,
      "Invalid or expired OTP code. Please request a new one.",
    );
  }

  // Check attempt threshold
  if (otpRecord.attempts >= 3) {
    await OTP.findByIdAndDelete(otpRecord._id);
    throw new CustomError(
      400,
      "Too many failed attempts. This OTP has been invalidated. Please request a new one.",
    );
  }

  // Increment attempts
  otpRecord.attempts += 1;
  await otpRecord.save();

  // Compare OTP
  const isMatch = await otpRecord.compareOTP(otp);
  if (!isMatch) {
    const remaining = 3 - otpRecord.attempts;
    throw new CustomError(
      400,
      `Incorrect OTP code. ${remaining} attempt(s) remaining.`,
    );
  }

  // Mark as verified and cleanup
  otpRecord.isVerified = true;
  await otpRecord.save();

  // Delete consumed OTP
  await OTP.findByIdAndDelete(otpRecord._id);

  return {
    success: true,
    message: "OTP code verified successfully.",
  };
};
