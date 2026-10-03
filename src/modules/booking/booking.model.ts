import mongoose, { Schema } from "mongoose";
import { IBooking, IAppliedDiscount, IPaymentInfo } from "./booking.interface";

const appliedDiscountSchema = new Schema<IAppliedDiscount>(
  {
    type: {
      type: String,
      enum: ["48h_early_bird", "profile_completion", "permanent_plan", "none"],
      default: "none",
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "DiscountCoupon",
    },
  },
  { _id: false },
);

const paymentInfoSchema = new Schema<IPaymentInfo>(
  {
    method: {
      type: String,
      enum: ["gateway", "admin_manual"],
      required: true,
      default: "gateway",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      required: true,
      default: "pending",
    },
    tranId: { type: String, trim: true },
    valId: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    cardType: { type: String, trim: true },
    paidAt: { type: Date },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    groundId: {
      type: Schema.Types.ObjectId,
      ref: "Ground",
      required: [true, "Ground ID is required"],
    },
    bookingType: {
      type: String,
      enum: ["one_time", "permanent"],
      default: "one_time",
    },
    permanentBookingId: {
      type: Schema.Types.ObjectId,
      ref: "PermanentBooking",
    },
    date: {
      type: String,
      required: [true, "Booking date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
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
    status: {
      type: String,
      enum: ["PENDING", "BOOKED", "CANCELLED", "EXPIRED", "NO_SHOW"],
      default: "PENDING",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, "Customer phone is required"],
      trim: true,
      match: [/^01[3-9]\d{8}$/, "Phone must be a valid Bangladeshi number"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    appliedDiscount: {
      type: appliedDiscountSchema,
    },
    holdExpiresAt: {
      type: Date,
    },
    payment: {
      type: paymentInfoSchema,
      required: true,
    },
    bookedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "AdminUser",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

// Concurrency handling: partial unique index (one active booking per ground+date+startTime)
bookingSchema.index(
  { groundId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["PENDING", "BOOKED"] } },
  },
);

// 15-minute hold auto-expiry via TTL index
bookingSchema.index(
  { holdExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: "PENDING" },
  },
);

// Query indexes for fast lookup
bookingSchema.index({ customerPhone: 1, status: 1 });
bookingSchema.index({ date: 1, groundId: 1 });

const Booking = mongoose.model<IBooking>("Booking", bookingSchema);

export default Booking;
