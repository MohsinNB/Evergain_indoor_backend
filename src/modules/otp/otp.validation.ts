import { z } from "zod";

const phoneRegex = /^01[3-9]\d{8}$/;
const purposeEnum = z.enum([
  "signup",
  "login",
  "reset_password",
  "booking_verification",
]);

export const sendOTPSchema = z
  .object({
    channel: z.enum(["sms", "email"]).optional().default("sms"),
    phone: z
      .string()
      .regex(phoneRegex, "Phone must be a valid Bangladeshi number (e.g. 01712345678)")
      .optional(),
    email: z.string().email("Must be a valid email address").optional(),
    purpose: purposeEnum.optional().default("signup"),
  })
  .refine(
    (data) => {
      if (data.channel === "sms" && !data.phone) return false;
      if (data.channel === "email" && !data.email) return false;
      return true;
    },
    {
      message: "Phone number is required for SMS channel, and Email address is required for Email channel.",
      path: ["channel"],
    },
  );

export const verifyOTPSchema = z
  .object({
    channel: z.enum(["sms", "email"]).optional().default("sms"),
    phone: z.string().regex(phoneRegex, "Phone must be a valid Bangladeshi number").optional(),
    email: z.string().email("Must be a valid email address").optional(),
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must contain numbers only"),
    purpose: purposeEnum.optional().default("signup"),
  })
  .refine(
    (data) => {
      if (data.channel === "sms" && !data.phone) return false;
      if (data.channel === "email" && !data.email) return false;
      return true;
    },
    {
      message: "Phone number is required for SMS channel, and Email address is required for Email channel.",
      path: ["channel"],
    },
  );

export type SendOTPZodInput = z.infer<typeof sendOTPSchema>;
export type VerifyOTPZodInput = z.infer<typeof verifyOTPSchema>;
