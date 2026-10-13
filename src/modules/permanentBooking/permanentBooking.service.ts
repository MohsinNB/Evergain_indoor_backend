import PermanentBooking from "./permanentBooking.model";
import { IPermanentBooking } from "./permanentBooking.interface";
import { CreatePermanentBookingZodInput, UpdatePlanDiscountZodInput } from "./permanentBooking.validation";
import Customer from "../customer/customer.model";
import Ground from "../ground/ground.model";
import Booking from "../booking/booking.model";
import CustomError from "../../helpers/CustomError";
import { generateWeeklyBookingsForPlan } from "./weeklyGenerator.job";
import { logAuditAction } from "../auditLog/auditLog.service";

/** Helper to calculate endTime */
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
 * Create a new Permanent Booking Plan for a registered Customer
 */
export const createPermanentBookingPlan = async (
  customerId: string,
  data: CreatePermanentBookingZodInput,
): Promise<IPermanentBooking> => {
  // 1. Verify customer exists and is registered
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.isRegistered) {
    throw new CustomError(
      400,
      "Only registered customers can create a permanent recurring booking commitment. Please complete your registration.",
    );
  }

  // 2. Limit: at most 1 active plan per customer
  const customerActivePlan = await PermanentBooking.findOne({
    customerId: customer._id,
    status: "active",
  });
  if (customerActivePlan) {
    throw new CustomError(
      400,
      "You already have an active permanent booking plan. Each customer is limited to 1 active recurring plan.",
    );
  }

  // 3. Verify startDate is not in the past
  const todayStr = new Date().toISOString().split("T")[0]!;
  if (data.startDate < todayStr) {
    throw new CustomError(400, "Permanent booking start date cannot be in the past.");
  }

  // 4. Verify ground exists and is active
  const ground = await Ground.findById(data.groundId);
  if (!ground || !ground.isActive) {
    throw new CustomError(404, "Active ground not found.");
  }

  // 5. Verify slot schedule matches ground hours
  const [startH, startM] = data.startTime.split(":").map(Number);
  const [openH, openM] = ground.openingTime.split(":").map(Number);
  const [closeH, closeM] = ground.closingTime.split(":").map(Number);

  let slotStartMins = (startH ?? 0) * 60 + (startM ?? 0);
  const openMins = (openH ?? 0) * 60 + (openM ?? 0);
  let closeMins = (closeH ?? 0) * 60 + (closeM ?? 0);

  if (closeMins <= openMins) closeMins += 24 * 60;
  if (closeMins > 24 * 60 && slotStartMins < openMins) slotStartMins += 24 * 60;

  if (
    slotStartMins < openMins ||
    slotStartMins + ground.slotDurationMinutes > closeMins ||
    (slotStartMins - openMins) % ground.slotDurationMinutes !== 0
  ) {
    throw new CustomError(
      400,
      `Slot ${data.startTime} is invalid for ground schedule (${ground.openingTime} - ${ground.closingTime}).`,
    );
  }

  // 6. Check for existing active permanent booking for this slot
  const existingPlan = await PermanentBooking.findOne({
    groundId: data.groundId,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    status: "active",
  });

  if (existingPlan) {
    throw new CustomError(
      409,
      `A permanent booking plan is already active for day ${data.dayOfWeek} at ${data.startTime}.`,
    );
  }

  const endTime = calculateEndTime(data.startTime, ground.slotDurationMinutes);
  const commitmentMonths = data.commitmentMonths || 3;

  const planPayload: Record<string, any> = {
    customerId: customer._id,
    groundId: ground._id,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime,
    startDate: data.startDate,
    commitmentMonths,
    discountType: "fixed",
    discountValue: 50, // Default ৳50 permanent plan discount
    paymentStatus: "unpaid",
    status: "active",
  };

  const plan = await PermanentBooking.create(planPayload);

  // 4. Pre-generate weekly booking documents for this plan
  await generateWeeklyBookingsForPlan(plan);

  // 5. Audit Log
  await logAuditAction({
    actorId: customer._id,
    actorName: customer.name,
    actorRole: "customer",
    action: "permanent_booking.create",
    targetId: String(plan._id),
    afterState: {
      dayOfWeek: plan.dayOfWeek,
      startTime: plan.startTime,
      startDate: plan.startDate,
      commitmentMonths: plan.commitmentMonths,
    },
  });

  return plan;
};

/**
 * Get permanent booking plans for current logged in customer
 */
export const getCustomerPermanentBookings = async (
  customerId: string,
): Promise<IPermanentBooking[]> => {
  return PermanentBooking.find({ customerId })
    .populate("groundId", "name location pricePerSlot")
    .sort({ createdAt: -1 });
};

/**
 * Get all permanent booking plans for Admin management
 */
export const getAllPermanentBookingsForAdmin = async (query: {
  status?: string;
  groundId?: string;
  page?: number;
  limit?: number;
}): Promise<{ plans: IPermanentBooking[]; total: number }> => {
  const filter: Record<string, any> = {};

  if (query.status) filter["status"] = query.status;
  if (query.groundId) filter["groundId"] = query.groundId;

  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;

  const [plans, total] = await Promise.all([
    PermanentBooking.find(filter)
      .populate("customerId", "name phone email isRegistered totalBookings")
      .populate("groundId", "name location pricePerSlot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PermanentBooking.countDocuments(filter),
  ]);

  return { plans, total };
};

/**
 * Cancel a permanent booking plan (Admin or Customer)
 */
export const cancelPermanentBookingPlan = async (
  planId: string,
  actorId?: string,
  actorRole = "admin",
): Promise<IPermanentBooking> => {
  const plan = await PermanentBooking.findById(planId);
  if (!plan) {
    throw new CustomError(404, "Permanent booking plan not found.");
  }

  if (plan.status === "cancelled") {
    throw new CustomError(400, "Permanent booking plan is already cancelled.");
  }

  if (actorRole === "customer" && String(plan.customerId) !== String(actorId)) {
    throw new CustomError(403, "You do not have permission to cancel this permanent booking plan.");
  }

  plan.status = "cancelled";
  await plan.save();

  // Free up any upcoming BOOKED slots generated by this plan that haven't occurred yet
  const todayStr = new Date().toISOString().split("T")[0]!;
  await Booking.updateMany(
    {
      permanentBookingId: plan._id,
      date: { $gte: todayStr } as any,
      status: "BOOKED",
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: `Permanent booking plan cancelled by ${actorRole}.`,
      },
    },
  );

  // Audit Log
  await logAuditAction({
    actorId,
    actorRole,
    action: "permanent_booking.cancel",
    targetId: String(plan._id),
  });

  return plan;
};

/**
 * Admin updates discount for permanent booking plan
 */
export const updatePermanentBookingDiscount = async (
  planId: string,
  updateData: UpdatePlanDiscountZodInput,
  adminId?: string,
): Promise<IPermanentBooking> => {
  const plan = await PermanentBooking.findById(planId);
  if (!plan) {
    throw new CustomError(404, "Permanent booking plan not found.");
  }

  const beforeState = { discountType: plan.discountType, discountValue: plan.discountValue };

  plan.discountType = updateData.discountType;
  plan.discountValue = updateData.discountValue;
  await plan.save();

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "permanent_booking.discount_update",
    targetId: String(plan._id),
    beforeState,
    afterState: { discountType: plan.discountType, discountValue: plan.discountValue },
  });

  return plan;
};

/**
 * Admin marks a full permanent booking plan as paid (Cash / bKash / Bank)
 */
export const markPermanentPlanAsPaid = async (
  planId: string,
  paymentMethod: "CASH" | "BKASH" | "BANK" = "BKASH",
  paymentNotes?: string,
  adminId?: string,
): Promise<IPermanentBooking> => {
  const plan = await PermanentBooking.findById(planId);
  if (!plan) {
    throw new CustomError(404, "Permanent booking plan not found.");
  }

  const beforeState = { paymentStatus: plan.paymentStatus };
  plan.paymentStatus = "paid";
  plan.paymentMethod = paymentMethod;
  plan.paymentNotes = paymentNotes;
  plan.paidAt = new Date();
  await plan.save();

  // Atomically update all bookings for this plan to paid
  await Booking.updateMany(
    { permanentBookingId: plan._id, status: "BOOKED" },
    {
      $set: {
        "payment.status": "paid",
        "payment.method": "admin_manual",
        "payment.cardType": paymentMethod,
        "payment.paidAt": new Date(),
      },
    },
  );

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "permanent_booking.mark_paid",
    targetId: String(plan._id),
    beforeState,
    afterState: {
      paymentStatus: "paid",
      paymentMethod,
      paymentNotes,
      paidAt: plan.paidAt,
    },
  });

  return plan;
};
