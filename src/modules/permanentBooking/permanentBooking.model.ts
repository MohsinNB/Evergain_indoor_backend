import mongoose, { Schema } from "mongoose";
import { IPermanentBooking } from "./permanentBooking.interface";

const permanentBookingSchema = new Schema<IPermanentBooking>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer ID is required"],
    },
    groundId: {
      type: Schema.Types.ObjectId,
      ref: "Ground",
      required: [true, "Ground ID is required"],
    },
    dayOfWeek: {
      type: Number,
      required: [true, "Day of week (0-6) is required"],
      min: [0, "Day of week must be between 0 (Sunday) and 6 (Saturday)"],
      max: [6, "Day of week must be between 0 (Sunday) and 6 (Saturday)"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [/^\d{2}:\d{2}$/, "Start time must be in HH:mm format"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [/^\d{2}:\d{2}$/, "End time must be in HH:mm format"],
    },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    discountValue: {
      type: Number,
      default: 50,
      min: [0, "Discount value cannot be negative"],
    },
    startDate: {
      type: String,
      required: [true, "Start date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"],
    },
    commitmentMonths: {
      type: Number,
      default: 3,
      min: [3, "Commitment period must be at least 3 months"],
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

permanentBookingSchema.index({ status: 1, dayOfWeek: 1 });
permanentBookingSchema.index({ customerId: 1, status: 1 });
permanentBookingSchema.index({ groundId: 1, dayOfWeek: 1, startTime: 1 });

const PermanentBooking = mongoose.model<IPermanentBooking>(
  "PermanentBooking",
  permanentBookingSchema,
);

export default PermanentBooking;
