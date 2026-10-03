import PermanentBooking from "./permanentBooking.model";
import { IPermanentBooking } from "./permanentBooking.interface";
import { CreatePermanentBookingZodInput, UpdatePlanDiscountZodInput } from "./permanentBooking.validation";
import Customer from "../customer/customer.model";
import Ground from "../ground/ground.model";
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

  // 2. Verify ground exists and is active
  const ground = await Ground.findById(data.groundId);
  if (!ground || !ground.isActive) {
    throw new CustomError(404, "Active ground not found.");
  }

  // 3. Check for existing active permanent booking for this slot
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

  plan.status = "cancelled";
  await plan.save();

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
