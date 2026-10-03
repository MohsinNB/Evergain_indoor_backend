import { z } from "zod";

export const uploadGalleryQuerySchema = z.object({
  caption: z.string().trim().max(300, "Caption cannot exceed 300 characters").optional(),
  displayOrder: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val), "Display order must be a valid number")
    .optional(),
});

export const updateGallerySchema = z.object({
  caption: z.string().trim().max(300, "Caption cannot exceed 300 characters").optional(),
  displayOrder: z.number().min(0, "Display order cannot be negative").optional(),
});

export const reorderGallerySchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().min(1, "Image ID is required"),
        displayOrder: z.number().min(0, "Display order must be a non-negative number"),
      }),
    )
    .min(1, "At least one order entry is required"),
});

export type UpdateGalleryZodInput = z.infer<typeof updateGallerySchema>;
export type ReorderGalleryZodInput = z.infer<typeof reorderGallerySchema>;
