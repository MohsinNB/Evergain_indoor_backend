import mongoose, { Schema } from "mongoose";
import { IGround, IClosure } from "./ground.interface";

const closureSchema = new Schema<IClosure>(
  {
    date: {
      type: String,
      required: [true, "Closure date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Closure date must be in YYYY-MM-DD format"],
    },
    reason: {
      type: String,
      required: [true, "Closure reason is required"],
      trim: true,
      maxlength: [200, "Reason must be at most 200 characters"],
    },
  },
  { _id: false },
);

const groundSchema = new Schema<IGround>(
  {
    name: {
      type: String,
      required: [true, "Ground name is required"],
      trim: true,
      maxlength: [100, "Name must be at most 100 characters"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [300, "Location must be at most 300 characters"],
    },
    openingTime: {
      type: String,
      required: [true, "Opening time is required"],
      match: [/^\d{2}:\d{2}$/, "Opening time must be in HH:mm format"],
    },
    closingTime: {
      type: String,
      required: [true, "Closing time is required"],
      match: [/^\d{2}:\d{2}$/, "Closing time must be in HH:mm format"],
    },
    slotDurationMinutes: {
      type: Number,
      required: [true, "Slot duration is required"],
      min: [15, "Slot duration must be at least 15 minutes"],
      max: [480, "Slot duration must not exceed 480 minutes"],
    },
    pricePerSlot: {
      type: Number,
      required: [true, "Price per slot is required"],
      min: [0, "Price must not be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    closures: {
      type: [closureSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const Ground = mongoose.model<IGround>("Ground", groundSchema);

export default Ground;
