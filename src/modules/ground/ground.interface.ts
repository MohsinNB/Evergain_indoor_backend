import { Document, Types } from "mongoose";

export interface IClosure {
  date: string; // "YYYY-MM-DD" — wall-clock, no timezone math
  reason: string;
}

export interface IGround extends Document {
  _id: Types.ObjectId;
  name: string;
  location: string;
  openingTime: string;  // "HH:mm" wall-clock Asia/Dhaka
  closingTime: string;  // "HH:mm" wall-clock Asia/Dhaka
  slotDurationMinutes: number;
  pricePerSlot: number; // BDT
  isActive: boolean;
  closures: IClosure[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Derived types used across other modules ────────────────────────────────

/** A single generated slot returned from GET /slots */
export interface ISlotView {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  price: number;     // possibly discounted
  isDiscounted: boolean;
  originalPrice: number;
  status: "available" | "unavailable";
}
