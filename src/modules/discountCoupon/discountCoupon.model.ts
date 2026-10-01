import mongoose, { Schema } from "mongoose";
import { IDiscountCoupon } from "./discountCoupon.interface";

const discountCouponSchema = new Schema<IDiscountCoupon>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer ID is required"],
    },
    type: {
      type: String,
      enum: ["profile_completion", "promotional"],
      default: "profile_completion",
    },
    amountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    amountValue: {
      type: Number,
      required: [true, "Amount value is required"],
      min: [0, "Discount amount cannot be negative"],
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedInBookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

discountCouponSchema.index({ customerId: 1, isUsed: 1 });

const DiscountCoupon = mongoose.model<IDiscountCoupon>("DiscountCoupon", discountCouponSchema);

export default DiscountCoupon;
