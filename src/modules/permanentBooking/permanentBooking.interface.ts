import { Document, Types } from "mongoose";

export type PermanentBookingStatus = "active" | "cancelled" | "completed";
export type PlanDiscountType = "fixed" | "percentage";

export interface IPermanentBooking extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  groundId: Types.ObjectId;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  discountType: PlanDiscountType;
  discountValue: number;
  startDate: string; // "YYYY-MM-DD"
  commitmentMonths: number; // Minimum 3 months
  status: PermanentBookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePermanentBookingInput = {
  groundId: string;
  dayOfWeek: number;
  startTime: string;
  startDate: string;
  commitmentMonths?: number;
};

export type UpdatePlanDiscountInput = {
  discountType: PlanDiscountType;
  discountValue: number;
};
