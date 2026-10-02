import { z } from "zod";

const hhmmRegex = /^\d{2}:\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const hhmmString = (label: string) =>
  z
    .string()
    .regex(hhmmRegex, `${label} must be in HH:mm format (e.g. 08:00)`);

const closureSchema = z.object({
  date: z
    .string()
    .regex(dateRegex, "Closure date must be in YYYY-MM-DD format"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason must not be empty")
    .max(200, "Reason must be at most 200 characters"),
});

// Slot availability query schema
export const getSlotsQuerySchema = z.object({
  date: z
    .string()
    .regex(dateRegex, "date must be in YYYY-MM-DD format"),
  groundId: z.string().optional(),
});

// Create ground schema
export const createGroundSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name must not be empty")
      .max(100, "Name must be at most 100 characters"),
    location: z
      .string()
      .trim()
      .min(1, "Location must not be empty")
      .max(300, "Location must be at most 300 characters"),
    openingTime: hhmmString("Opening time"),
    closingTime: hhmmString("Closing time"),
    slotDurationMinutes: z
      .number()
      .int("Slot duration must be an integer")
      .min(15, "Slot duration must be at least 15 minutes")
      .max(480, "Slot duration must not exceed 480 minutes"),
    pricePerSlot: z
      .number()
      .min(0, "Price must not be negative"),
    isActive: z.boolean().optional().default(true),
    closures: z.array(closureSchema).optional().default([]),
  })
  .refine(
    (data) => data.openingTime < data.closingTime,
    {
      message: "Opening time must be before closing time",
      path: ["openingTime"],
    },
  );

// Update ground settings schema
export const updateGroundSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    location: z.string().trim().min(1).max(300).optional(),
    openingTime: hhmmString("Opening time").optional(),
    closingTime: hhmmString("Closing time").optional(),
    slotDurationMinutes: z.number().int().min(15).max(480).optional(),
    pricePerSlot: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    addClosures: z.array(closureSchema).optional(),
    removeClosureDates: z
      .array(
        z.string().regex(dateRegex, "Each date must be in YYYY-MM-DD format"),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.openingTime && data.closingTime) {
        return data.openingTime < data.closingTime;
      }
      return true;
    },
    {
      message: "Opening time must be before closing time",
      path: ["openingTime"],
    },
  );

export type GetSlotsQuery = z.infer<typeof getSlotsQuerySchema>;
export type CreateGroundInput = z.infer<typeof createGroundSchema>;
export type UpdateGroundSettingsInput = z.infer<typeof updateGroundSettingsSchema>;
