import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const hhmmRegex = /^\d{2}:\d{2}$/;

export const createPermanentBookingSchema = z.object({
  groundId: z.string().min(1, "Ground ID is required"),
  dayOfWeek: z
    .number()
    .int()
    .min(0, "Day of week must be 0 (Sunday) to 6 (Saturday)")
    .max(6, "Day of week must be 0 (Sunday) to 6 (Saturday)"),
  startTime: z.string().regex(hhmmRegex, "Start time must be in HH:mm format"),
  startDate: z.string().regex(dateRegex, "Start date must be in YYYY-MM-DD format"),
  commitmentMonths: z.number().int().min(3, "Commitment period must be at least 3 months").optional().default(3),
});

export const updatePlanDiscountSchema = z.object({
  discountType: z.enum(["fixed", "percentage"]),
  discountValue: z.number().min(0, "Discount value cannot be negative"),
});

export type CreatePermanentBookingZodInput = z.infer<typeof createPermanentBookingSchema>;
export type UpdatePlanDiscountZodInput = z.infer<typeof updatePlanDiscountSchema>;
