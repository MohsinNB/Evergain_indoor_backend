import { Request, Response, NextFunction } from "express";
import { sendOTPService, verifyOTPService } from "./otp.service";
import { sendOTPSchema, verifyOTPSchema } from "./otp.validation";
import CustomError from "../../helpers/CustomError";

/**
 * POST /api/v1/otp/send
 * Sends OTP to phone (SMS) and optionally email (Nodemailer).
 */
export const sendOTPHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = sendOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const result = await sendOTPService(parsed.data);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/otp/verify
 * Verifies 6-digit OTP.
 */
export const verifyOTPHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = verifyOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const result = await verifyOTPService(parsed.data);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        isVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
