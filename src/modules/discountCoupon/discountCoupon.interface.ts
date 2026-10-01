import { Document, Types } from "mongoose";

export type CouponType = "profile_completion" | "promotional";
export type DiscountAmountType = "fixed" | "percentage";

export interface IDiscountCoupon extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  type: CouponType;
  amountType: DiscountAmountType;
  amountValue: number;
  isUsed: boolean;
  usedInBookingId?: Types.ObjectId;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
