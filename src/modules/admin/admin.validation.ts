import { z } from "zod";

const phoneRegex = /^01[3-9]\d{8}$/;

export const createAdminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name must not be empty")
    .max(100, "Name must be at most 100 characters"),
  phone: z
    .string()
    .regex(phoneRegex, "Phone must be a valid Bangladeshi number (e.g. 01712345678)"),
  email: z.string().email("Must be a valid email address").optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "admin", "staff"]).optional().default("admin"),
});

export const updateAdminSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().regex(phoneRegex, "Phone must be a valid Bangladeshi number").optional(),
  email: z.string().email("Must be a valid email address").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["super_admin", "admin", "staff"]).optional(),
  isActive: z.boolean().optional(),
});

export const adminLoginSchema = z
  .object({
    identifier: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.identifier || data.phone || data.email), {
    message: "Provide phone number or email to login",
    path: ["phone"],
  });

export type CreateAdminZodInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminZodInput = z.infer<typeof updateAdminSchema>;
export type AdminLoginZodInput = z.infer<typeof adminLoginSchema>;
