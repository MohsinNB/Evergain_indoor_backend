import cron from "node-cron";
import PermanentBooking from "./permanentBooking.model";
import { IPermanentBooking } from "./permanentBooking.interface";
import Booking from "../booking/booking.model";
import Ground from "../ground/ground.model";
import Customer from "../customer/customer.model";

/**
 * Calculates dates of all matching days of week within commitment period
 */
const getMatchingDatesForPlan = (
  startDateStr: string,
  targetDayOfWeek: number, // 0=Sun, 1=Mon, ..., 6=Sat
  commitmentMonths: number,
): string[] => {
  const dates: string[] = [];

  const [y, m, d] = startDateStr.split("-").map(Number);
  const current = new Date(Date.UTC(y!, m! - 1, d!));

  const end = new Date(current);
  end.setUTCMonth(end.getUTCMonth() + commitmentMonths);

  while (current <= end) {
    if (current.getUTCDay() === targetDayOfWeek) {
      const dateStr = current.toISOString().split("T")[0]!;
      dates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

/**
 * Pre-generate weekly booking records for a single PermanentBooking plan
 */
export const generateWeeklyBookingsForPlan = async (
  plan: IPermanentBooking,
): Promise<number> => {
  const [ground, customer] = await Promise.all([
    Ground.findById(plan.groundId),
    Customer.findById(plan.customerId),
  ]);

  if (!ground || !customer) return 0;

  const targetDates = getMatchingDatesForPlan(
    plan.startDate,
    plan.dayOfWeek,
    plan.commitmentMonths,
  );

  let generatedCount = 0;

  for (const dateStr of targetDates) {
    // Check if slot is already booked or has an active PENDING hold
    const existingBooking = await Booking.findOne({
      groundId: plan.groundId,
      date: dateStr,
      startTime: plan.startTime,
      $or: [
        { status: "BOOKED" },
        { status: "PENDING", holdExpiresAt: { $gt: new Date() } },
      ],
    });

    if (!existingBooking) {
      // Calculate permanent plan discounted price
      let discountAmount = 0;
      if (plan.discountType === "fixed") {
        discountAmount = Math.min(plan.discountValue, ground.pricePerSlot);
      } else if (plan.discountType === "percentage") {
        discountAmount = Math.min(
          Math.round((ground.pricePerSlot * plan.discountValue) / 100),
          ground.pricePerSlot,
        );
      }

      const finalPrice = Math.max(0, ground.pricePerSlot - discountAmount);

      try {
        await Booking.create({
          groundId: plan.groundId,
          bookingType: "permanent",
          permanentBookingId: plan._id,
          date: dateStr,
          startTime: plan.startTime,
          endTime: plan.endTime,
          status: "BOOKED",
          customerId: customer._id,
          customerName: customer.name,
          customerPhone: customer.phone,
          price: finalPrice,
          appliedDiscount: {
            type: "permanent_plan",
            amount: discountAmount,
          },
          payment: {
            method: "admin_manual",
            status: "paid",
            amount: finalPrice,
            paidAt: new Date(),
          },
          confirmedAt: new Date(),
        });

        customer.totalBookings += 1;
        generatedCount += 1;
      } catch (err: any) {
        // Ignore duplicate key race condition
      }
    }
  }

  await customer.save();
  return generatedCount;
};

/**
 * Main Cron Runner for all active PermanentBooking plans
 */
export const runWeeklyBookingGenerator = async (): Promise<void> => {
  console.log("[Cron Job]: Running Weekly Booking Auto-Generator...");
  try {
    const activePlans = await PermanentBooking.find({ status: "active" });
    let totalGenerated = 0;

    for (const plan of activePlans) {
      const count = await generateWeeklyBookingsForPlan(plan);
      totalGenerated += count;
    }

    console.log(
      `[Cron Job]: Weekly Booking Auto-Generator completed. ${totalGenerated} new booking(s) generated for ${activePlans.length} active plan(s).`,
    );
  } catch (error) {
    console.error("[Cron Job Error]:", error);
  }
};

/**
 * Initialize node-cron schedule (Runs daily at 01:00 AM)
 */
export const initWeeklyCronSchedule = (): void => {
  // Schedule: 0 1 * * * (Daily at 01:00 AM)
  cron.schedule("0 1 * * *", () => {
    runWeeklyBookingGenerator();
  });
  console.log("[Cron Schedule]: Permanent Booking Auto-Generator scheduled daily at 01:00 AM.");
};
