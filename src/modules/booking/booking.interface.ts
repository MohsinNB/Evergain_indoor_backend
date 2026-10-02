import { Document, Types } from "mongoose";

export type BookingType = "one_time" | "permanent";
export type BookingStatus = "PENDING" | "BOOKED" | "CANCELLED" | "EXPIRED" | "NO_SHOW";
export type PaymentMethod = "gateway" | "admin_manual";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface IAppliedDiscount {
  type: "48h_early_bird" | "profile_completion" | "permanent_plan" | "none";
  amount: number;
}

export interface IPaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  tranId?: string;
  valId?: string;
  amount: number;
  cardType?: string;
  paidAt?: Date;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  groundId: Types.ObjectId;
  bookingType: BookingType;
  permanentBookingId?: Types.ObjectId;
  date: string;       // "YYYY-MM-DD" wall-clock Asia/Dhaka
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  status: BookingStatus;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  price: number;
  appliedDiscount?: IAppliedDiscount;
  holdExpiresAt?: Date;
  payment: IPaymentInfo;
  bookedByAdminId?: Types.ObjectId; // Traces if created manually by admin
  notes?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAdminManualBookingInput = {
  groundId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  price?: number;
  paymentStatus?: "paid" | "pending";
  notes?: string;
};
