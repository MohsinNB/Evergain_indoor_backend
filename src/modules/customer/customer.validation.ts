import { z } from "zod";

const phoneRegex = /^01[3-9]\d{8}$/;

export const customerSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name must not be empty")
    .max(100, "Name must be at most 100 characters"),
  phone: z
    .string()
    .regex(phoneRegex, "Phone must be a valid Bangladeshi number (e.g. 01712345678)"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  email: z
    .string()
    .email("Email must be a valid email address")
    .optional(),
});

export const customerLoginSchema = z.object({
  phone: z.string().regex(phoneRegex, "Phone must be a valid Bangladeshi number"),
  password: z.string().min(1, "Password is required"),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
  email: z.string().email("Must be a valid email address").optional(),
});

export type CustomerSignupZodInput = z.infer<typeof customerSignupSchema>;
export type CustomerLoginZodInput = z.infer<typeof customerLoginSchema>;
export type UpdateCustomerProfileZodInput = z.infer<typeof updateCustomerProfileSchema>;
