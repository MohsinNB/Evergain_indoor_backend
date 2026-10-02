import Booking from "./booking.model";
import { IBooking, IPaymentInfo } from "./booking.interface";
import { CreateAdminManualBookingZodInput } from "./booking.validation";
import Ground from "../ground/ground.model";
import Customer from "../customer/customer.model";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";

/**
 * Returns a Set of startTime strings ("HH:mm") that are currently PENDING or BOOKED
 * for the given ground on the given date.
 * Plugs directly into GET /slots availability computation!
 */
export const getBookedStartTimes = async (
  groundId: string,
  date: string,
): Promise<Set<string>> => {
  const activeBookings = await Booking.find({
    groundId,
    date,
    status: { $in: ["PENDING", "BOOKED"] },
  }).select("startTime");

  return new Set(activeBookings.map((b) => b.startTime));
};

/**
 * Helper to calculate slot endTime given startTime and duration in minutes.
 */
const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = (h ?? 0) * 60 + (m ?? 0) + durationMinutes;
  const endH = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const endM = (totalMinutes % 60).toString().padStart(2, "0");
  return `${endH}:${endM}`;
};

/**
 * Admin Manual Booking / Temporary Slot Block
 * Creates an immediate BOOKED record with admin trace for financial auditability.
 */
export const createAdminManualBooking = async (
  adminId: string,
  data: CreateAdminManualBookingZodInput,
): Promise<IBooking> => {
  const ground = await Ground.findById(data.groundId);
  if (!ground || !ground.isActive) {
    throw new CustomError(404, "Active ground not found.");
  }

  // Check if date is a ground closure date
  const isClosed = ground.closures.some((c) => c.date === data.date);
  if (isClosed) {
    throw new CustomError(400, "Cannot book slot on a ground closure date.");
  }

  // Check existing active booking for this slot
  const existingSlotBooking = await Booking.findOne({
    groundId: data.groundId,
    date: data.date,
    startTime: data.startTime,
    status: { $in: ["PENDING", "BOOKED"] },
  });

  if (existingSlotBooking) {
    throw new CustomError(
      409,
      `Slot ${data.startTime} on ${data.date} is already ${existingSlotBooking.status.toLowerCase()}.`,
    );
  }

  // Upsert minimal Customer trace by phone
  let customer = await Customer.findOne({ phone: data.customerPhone });
  if (!customer) {
    customer = await Customer.create({
      name: data.customerName,
      phone: data.customerPhone,
      isRegistered: false,
    });
  }

  const endTime = calculateEndTime(data.startTime, ground.slotDurationMinutes);
  const finalPrice = data.price !== undefined ? data.price : ground.pricePerSlot;
  const paymentStatus = data.paymentStatus ?? "paid";

  const paymentInfo: IPaymentInfo = {
    method: "admin_manual",
    status: paymentStatus,
    amount: finalPrice,
  };
  if (paymentStatus === "paid") {
    paymentInfo.paidAt = new Date();
  }

  try {
    const bookingPayload: Record<string, any> = {
      groundId: ground._id,
      bookingType: "one_time",
      date: data.date,
      startTime: data.startTime,
      endTime,
      status: "BOOKED",
      customerId: customer._id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      price: finalPrice,
      payment: paymentInfo,
      bookedByAdminId: new Types.ObjectId(adminId),
      confirmedAt: new Date(),
    };
    if (data.notes) {
      bookingPayload["notes"] = data.notes;
    }

    const booking = await Booking.create(bookingPayload);

    // Increment customer booking count
    customer.totalBookings += 1;
    await customer.save();

    return booking;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new CustomError(409, `Slot ${data.startTime} on ${data.date} was just booked by another process.`);
    }
    throw error;
  }
};

/**
 * Get all bookings with filter options for Admin dashboard.
 */
export const getAdminBookings = async (query: {
  date?: string;
  status?: string;
  groundId?: string;
  limit?: number;
  page?: number;
}): Promise<{ bookings: IBooking[]; total: number }> => {
  const filter: Record<string, any> = {};

  if (query.date) filter["date"] = query.date;
  if (query.status) filter["status"] = query.status;
  if (query.groundId) filter["groundId"] = query.groundId;

  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 50;
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("bookedByAdminId", "name phone role")
      .sort({ date: -1, startTime: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return { bookings, total };
};

/**
 * Get single booking by ID.
 */
export const getBookingById = async (id: string): Promise<IBooking> => {
  const booking = await Booking.findById(id).populate("bookedByAdminId", "name phone role");
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }
  return booking;
};

/**
 * Admin cancels a booking.
 */
export const cancelBookingByAdmin = async (
  bookingId: string,
  cancelReason: string,
): Promise<IBooking> => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }

  if (booking.status === "CANCELLED") {
    throw new CustomError(400, "Booking is already cancelled.");
  }

  booking.status = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.cancelReason = cancelReason;

  await booking.save();
  return booking;
};

/**
 * Admin marks booking as NO_SHOW.
 */
export const markBookingNoShow = async (bookingId: string): Promise<IBooking> => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }

  if (booking.status !== "BOOKED") {
    throw new CustomError(400, `Only BOOKED bookings can be marked as NO_SHOW. Current status: ${booking.status}`);
  }

  booking.status = "NO_SHOW";
  await booking.save();
  return booking;
};
