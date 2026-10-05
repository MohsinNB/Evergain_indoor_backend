import Booking from "./booking.model";
import { IBooking, IPaymentInfo } from "./booking.interface";
import { CreateAdminManualBookingZodInput, CreateBookingRequestZodInput } from "./booking.validation";
import Ground from "../ground/ground.model";
import Customer from "../customer/customer.model";
import DiscountCoupon from "../discountCoupon/discountCoupon.model";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";
import { calculateBookingPrice } from "./pricing.util";
import { initSSLCommerzPayment } from "../payment/sslcommerz.service";
import { validateCustomerCoupon } from "../discountCoupon/discountCoupon.service";
import { logAuditAction } from "../auditLog/auditLog.service";
import config from "../../config";

export interface CreateGuestBookingRequestOutput {
  booking: IBooking;
  gatewayUrl: string;
  tranId: string;
  holdExpiresAt: Date;
}


/**
 * Returns a Set of startTime strings ("HH:mm") that are currently PENDING (and active) or BOOKED
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
    $or: [
      { status: "BOOKED" },
      { status: "PENDING", holdExpiresAt: { $gt: new Date() } },
    ],
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

  // Check existing active booking for this slot (BOOKED or active PENDING hold)
  const existingSlotBooking = await Booking.findOne({
    groundId: data.groundId,
    date: data.date,
    startTime: data.startTime,
    $or: [
      { status: "BOOKED" },
      { status: "PENDING", holdExpiresAt: { $gt: new Date() } },
    ],
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

    // Audit Log
    await logAuditAction({
      actorId: adminId,
      actorRole: "admin",
      action: "booking.admin_manual_create",
      targetId: String(booking._id),
      afterState: {
        groundId: booking.groundId,
        date: booking.date,
        startTime: booking.startTime,
        customerName: booking.customerName,
        price: booking.price,
      },
    });

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
  adminId?: string,
): Promise<IBooking> => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }

  if (booking.status === "CANCELLED") {
    throw new CustomError(400, "Booking is already cancelled.");
  }

  const beforeState = { status: booking.status };
  booking.status = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.cancelReason = cancelReason;

  await booking.save();

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "booking.cancel",
    targetId: String(booking._id),
    beforeState,
    afterState: { status: "CANCELLED", cancelReason },
  });

  return booking;
};

/**
 * Admin marks booking as NO_SHOW.
 */
export const markBookingNoShow = async (
  bookingId: string,
  adminId?: string,
): Promise<IBooking> => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }

  if (booking.status !== "BOOKED") {
    throw new CustomError(400, `Only BOOKED bookings can be marked as NO_SHOW. Current status: ${booking.status}`);
  }

  booking.status = "NO_SHOW";
  await booking.save();

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "booking.no_show",
    targetId: String(booking._id),
    afterState: { status: "NO_SHOW" },
  });

  return booking;
};

/**
 * Admin reverts a NO_SHOW or CANCELLED booking back to BOOKED.
 */
export const revertBookingToBooked = async (
  bookingId: string,
  adminId?: string,
): Promise<IBooking> => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new CustomError(404, "Booking not found.");
  }

  if (booking.status === "BOOKED") {
    throw new CustomError(400, "Booking is already active (BOOKED).");
  }

  const beforeState = { status: booking.status };
  booking.status = "BOOKED";
  booking.set("cancelledAt", undefined);
  booking.set("cancelReason", undefined);

  try {
    await booking.save();
  } catch (error: any) {
    if (error.code === 11000) {
      throw new CustomError(
        409,
        `Cannot restore to BOOKED: another active booking already exists for slot ${booking.startTime} on ${booking.date}.`,
      );
    }
    throw error;
  }

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "booking.revert_booked",
    targetId: String(booking._id),
    beforeState,
    afterState: { status: "BOOKED" },
  });

  return booking;
};

/**
 * Public Guest One-Time Booking Request
 * Creates a PENDING booking with 15-min hold, applies 48-hour early bird discount if eligible,
 * enforces hold-abuse protection (max 1 pending booking per phone), and initializes SSLCommerz session.
 */
export const createGuestBookingRequest = async (
  data: CreateBookingRequestZodInput,
  hostHeader?: string,
): Promise<CreateGuestBookingRequestOutput> => {
  // 1. Verify ground exists and is active
  const ground = await Ground.findById(data.groundId);
  if (!ground || !ground.isActive) {
    throw new CustomError(404, "Active ground not found.");
  }

  // 2. Check for ground closure on requested date
  const isClosed = ground.closures.some((c) => c.date === data.date);
  if (isClosed) {
    throw new CustomError(400, "Cannot book slot on a ground closure date.");
  }

  // 3. Verify startTime falls within opening and closing hours on exact slot duration boundaries
  const [startH, startM] = data.startTime.split(":").map(Number);
  const [openH, openM] = ground.openingTime.split(":").map(Number);
  const [closeH, closeM] = ground.closingTime.split(":").map(Number);

  const slotStartMins = (startH ?? 0) * 60 + (startM ?? 0);
  const openMins = (openH ?? 0) * 60 + (openM ?? 0);
  const closeMins = (closeH ?? 0) * 60 + (closeM ?? 0);

  if (
    slotStartMins < openMins ||
    slotStartMins + ground.slotDurationMinutes > closeMins ||
    (slotStartMins - openMins) % ground.slotDurationMinutes !== 0
  ) {
    throw new CustomError(
      400,
      `Slot ${data.startTime} is invalid for ground schedule (${ground.openingTime} - ${ground.closingTime}, duration ${ground.slotDurationMinutes} mins).`,
    );
  }

  // 4. Hold-abuse protection: Ensure customer phone does NOT have an active PENDING booking hold
  const existingPendingHold = await Booking.findOne({
    customerPhone: data.phone,
    status: "PENDING",
    holdExpiresAt: { $gt: new Date() },
  });

  if (existingPendingHold) {
    throw new CustomError(
      409,
      "You already have an active pending booking. Please complete it or wait for it to expire before booking another slot.",
    );
  }

  // 5. Clean up any stale expired pending holds for this slot to avoid TTL race conditions
  await Booking.updateMany(
    {
      groundId: data.groundId,
      date: data.date,
      startTime: data.startTime,
      status: "PENDING",
      holdExpiresAt: { $lte: new Date() },
    },
    { $set: { status: "EXPIRED" } },
  );

  // Check if the slot is currently BOOKED or has an active PENDING hold
  const existingSlotBooking = await Booking.findOne({
    groundId: data.groundId,
    date: data.date,
    startTime: data.startTime,
    $or: [
      { status: "BOOKED" },
      { status: "PENDING", holdExpiresAt: { $gt: new Date() } },
    ],
  });

  if (existingSlotBooking) {
    throw new CustomError(
      409,
      `Slot ${data.startTime} on ${data.date} is already ${existingSlotBooking.status.toLowerCase()}.`,
    );
  }

  // 6. Upsert Customer trace by phone
  let customer = await Customer.findOne({ phone: data.phone });
  if (!customer) {
    customer = await Customer.create({
      name: data.name,
      phone: data.phone,
      isRegistered: false,
    });
  }

  // Check optional discount coupon if provided
  let validCoupon = null;
  if (data.couponId) {
    validCoupon = await validateCustomerCoupon(data.couponId, String(customer._id));
  }

  // 7. Compute price and discounts (Single largest discount wins)
  const { price, appliedDiscount, appliedCouponId } = calculateBookingPrice(
    ground.pricePerSlot,
    data.date,
    data.startTime,
    validCoupon,
  );

  const discountToApply: Record<string, any> = { ...appliedDiscount };
  if (appliedCouponId) {
    discountToApply["couponId"] = new Types.ObjectId(appliedCouponId);
  }

  // 8. Prepare slot metadata
  const endTime = calculateEndTime(data.startTime, ground.slotDurationMinutes);
  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-min hold
  const tranId = `EAG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // 9. Save PENDING booking
  let booking: IBooking;
  try {
    booking = await Booking.create({
      groundId: ground._id,
      bookingType: "one_time",
      date: data.date,
      startTime: data.startTime,
      endTime,
      status: "PENDING",
      customerId: customer._id,
      customerName: data.name,
      customerPhone: data.phone,
      price,
      appliedDiscount: discountToApply,
      holdExpiresAt,
      payment: {
        method: "gateway",
        status: "pending",
        tranId,
        amount: price,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new CustomError(
        409,
        `Slot ${data.startTime} on ${data.date} was just selected by another user.`,
      );
    }
    throw error;
  }

  // 10. Initialize SSLCommerz Payment Session
  const hostUrl = hostHeader
    ? `${hostHeader.startsWith("http") ? "" : "http://"}${hostHeader}/api/v1`
    : `http://localhost:${config.port}/api/v1`;

  const sslRes = await initSSLCommerzPayment({
    tranId,
    amount: price,
    customerName: data.name,
    customerPhone: data.phone,
    customerEmail: customer.email,
    productName: `Evergain Football Slot (${data.date} ${data.startTime})`,
    successUrl: `${hostUrl}/payment/sslcommerz/success`,
    failUrl: `${hostUrl}/payment/sslcommerz/fail`,
    cancelUrl: `${hostUrl}/payment/sslcommerz/cancel`,
    ipnUrl: `${hostUrl}/payment/sslcommerz/ipn`,
  });

  if (!sslRes.GatewayPageURL) {
    throw new CustomError(
      500,
      `SSLCommerz session creation failed: ${sslRes.failedreason || "Unknown error"}`,
    );
  }

  return {
    booking,
    gatewayUrl: sslRes.GatewayPageURL,
    tranId,
    holdExpiresAt,
  };
};

/**
 * Public Booking Receipt / Confirmation Lookup by ID or Transaction ID
 */
export const getPublicBookingReceipt = async (identifier: string): Promise<any> => {
  let bookingDoc = null;
  if (Types.ObjectId.isValid(identifier)) {
    bookingDoc = await Booking.findById(identifier).populate("groundId", "name location");
  }
  if (!bookingDoc) {
    bookingDoc = await Booking.findOne({ "payment.tranId": identifier }).populate("groundId", "name location");
  }
  if (!bookingDoc) {
    throw new CustomError(404, "Booking not found.");
  }

  const booking = bookingDoc.toObject();
  const groundObj = booking.groundId as any;

  let showProfileOffer = false;
  let customer = null;

  if (booking.customerId) {
    customer = await Customer.findById(booking.customerId);
  } else if (booking.customerPhone) {
    customer = await Customer.findOne({ phone: booking.customerPhone });
  }

  if (customer) {
    const isRegistered = Boolean(customer.isRegistered);
    const hasCoupon = Boolean(
      await DiscountCoupon.exists({
        customerId: customer._id,
        type: "profile_completion",
      }),
    );
    showProfileOffer = !isRegistered && !hasCoupon;
  } else {
    showProfileOffer = true;
  }

  return {
    ...booking,
    groundName: groundObj?.name || "Evergain Avenue",
    groundLocation: groundObj?.location || "",
    showProfileOffer,
  };
};

/**
 * Get all bookings for logged-in Customer
 */
export const getMyCustomerBookings = async (
  customerId: string,
  customerPhone: string,
): Promise<IBooking[]> => {
  return Booking.find({
    $or: [
      { customerId: new Types.ObjectId(customerId) },
      { customerPhone },
    ],
  })
    .populate("groundId", "name location")
    .sort({ date: -1, startTime: -1 });
};

/**
 * Admin Monthly Calendar View (GET /api/v1/calendar?month=YYYY-MM)
 */
export const getMonthlyCalendarOverview = async (
  monthStr: string,
  groundId?: string,
): Promise<{
  month: string;
  days: Array<{
    date: string;
    dayOfWeek: number;
    isClosed: boolean;
    closureReason?: string;
    totalBookings: number;
    totalRevenue: number;
    bookings: Array<{
      id: string;
      startTime: string;
      endTime: string;
      status: string;
      customerName: string;
      customerPhone: string;
      price: number;
      paymentStatus?: string;
    }>;
  }>;
}> => {
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new CustomError(400, "Invalid month format. Expected YYYY-MM.");
  }

  let groundFilter: Record<string, any> = {};
  if (groundId) groundFilter["_id"] = groundId;
  const ground = await Ground.findOne(groundFilter);
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const datePrefix = `${year}-${String(month).padStart(2, "0")}`;

  const bookings = await Booking.find({
    groundId: ground._id,
    date: { $regex: `^${datePrefix}` },
  }).sort({ startTime: 1 });

  const bookingsByDate: Record<string, any[]> = {};
  for (const b of bookings) {
    const dStr = b.date;
    if (!bookingsByDate[dStr]) {
      bookingsByDate[dStr] = [];
    }
    bookingsByDate[dStr]!.push(b);
  }

  const daysResult = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const dateStr = `${datePrefix}-${dayStr}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();

    const closure = ground.closures?.find((c) => c.date === dateStr);
    const dayBookings = bookingsByDate[dateStr] || [];
    const confirmedBookings = dayBookings.filter((b) => b.status === "BOOKED");
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.price || 0), 0);

    const dayEntry: Record<string, any> = {
      date: dateStr,
      dayOfWeek,
      isClosed: !!closure,
      totalBookings: confirmedBookings.length,
      totalRevenue,
      bookings: dayBookings.map((b) => {
        const item: Record<string, any> = {
          id: String(b._id),
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          price: b.price,
        };
        if (b.payment?.status) {
          item["paymentStatus"] = b.payment.status;
        }
        return item;
      }),
    };
    if (closure?.reason) {
      dayEntry["closureReason"] = closure.reason;
    }

    daysResult.push(dayEntry);
  }

  return {
    month: datePrefix,
    days: daysResult as any,
  };
};

