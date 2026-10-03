import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const hhmmRegex = /^\d{2}:\d{2}$/;
const phoneRegex = /^01[3-9]\d{8}$/;

/**
 * Public Guest Booking Request schema
 */
export const createBookingRequestSchema = z.object({
  groundId: z.string().min(1, "Ground ID is required"),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(hhmmRegex, "Start time must be in HH:mm format"),
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().regex(phoneRegex, "Phone must be a valid Bangladeshi number"),
  couponId: z.string().optional(),
});

/**
 * Admin Manual Booking / Block Slot schema
 */
export const createAdminManualBookingSchema = z.object({
  groundId: z.string().min(1, "Ground ID is required"),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(hhmmRegex, "Start time must be in HH:mm format"),
  customerName: z.string().trim().min(1, "Customer / Block name is required").max(100),
  customerPhone: z.string().regex(phoneRegex, "Customer phone must be a valid Bangladeshi number"),
  price: z.number().min(0, "Price cannot be negative").optional(),
  paymentStatus: z.enum(["paid", "pending"]).optional().default("paid"),
  notes: z.string().max(500).optional(),
});

/**
 * Admin Cancel Booking schema
 */
export const cancelBookingSchema = z.object({
  cancelReason: z.string().trim().min(1, "Cancel reason is required").max(300),
});

export type CreateBookingRequestZodInput = z.infer<typeof createBookingRequestSchema>;
export type CreateAdminManualBookingZodInput = z.infer<typeof createAdminManualBookingSchema>;
export type CancelBookingZodInput = z.infer<typeof cancelBookingSchema>;
