import Booking from "../booking/booking.model";
import Ground from "../ground/ground.model";
import Customer from "../customer/customer.model";
import { IDailyAnalytics, IMonthlyAnalytics, IYearlyAnalytics } from "./analytics.interface";

/** Converts "HH:mm" to minutes since midnight */
const toMins = (hhMm: string): number => {
  const parts = hhMm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
};

/** Get today's date string in Asia/Dhaka wall-clock time "YYYY-MM-DD" */
const getDhakaTodayDateString = (): string => {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000); // UTC+6
  return d.toISOString().split("T")[0]!;
};

/**
 * Daily Analytics Report
 */
export const getDailyAnalytics = async (dateParam?: string): Promise<IDailyAnalytics> => {
  const targetDate = dateParam || getDhakaTodayDateString();

  const [bookings, ground] = await Promise.all([
    Booking.find({ date: targetDate }),
    Ground.findOne({ isActive: true }),
  ]);

  let totalRevenue = 0;
  let bookedCount = 0;
  let cancelledCount = 0;
  let noShowCount = 0;
  let pendingCount = 0;

  const paymentBreakdown = {
    gateway: { count: 0, revenue: 0 },
    admin_manual: { count: 0, revenue: 0 },
  };

  for (const b of bookings) {
    if (b.status === "BOOKED") {
      bookedCount += 1;
      totalRevenue += b.price;

      if (b.payment?.method === "admin_manual") {
        paymentBreakdown.admin_manual.count += 1;
        paymentBreakdown.admin_manual.revenue += b.price;
      } else {
        paymentBreakdown.gateway.count += 1;
        paymentBreakdown.gateway.revenue += b.price;
      }
    } else if (b.status === "CANCELLED") {
      cancelledCount += 1;
    } else if (b.status === "NO_SHOW") {
      noShowCount += 1;
    } else if (b.status === "PENDING") {
      pendingCount += 1;
    }
  }

  // Calculate total possible slots per day
  let totalPossibleSlots = 14; // Default fallback
  if (ground) {
    const openMins = toMins(ground.openingTime);
    const closeMins = toMins(ground.closingTime);
    totalPossibleSlots = Math.floor((closeMins - openMins) / ground.slotDurationMinutes);
  }

  const occupancyRate = totalPossibleSlots > 0
    ? Math.round((bookedCount / totalPossibleSlots) * 100 * 10) / 10
    : 0;

  return {
    date: targetDate,
    totalRevenue,
    totalBookingsCount: bookings.length,
    bookedCount,
    cancelledCount,
    noShowCount,
    pendingCount,
    paymentMethodBreakdown: paymentBreakdown,
    occupancyRate,
  };
};

/**
 * Monthly Analytics Report
 */
export const getMonthlyAnalytics = async (
  yearParam?: number,
  monthParam?: number,
): Promise<IMonthlyAnalytics> => {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const year = yearParam || now.getUTCFullYear();
  const month = monthParam || now.getUTCMonth() + 1;

  const monthStr = month.toString().padStart(2, "0");
  const monthRegex = new RegExp(`^${year}-${monthStr}`);

  const bookings = await Booking.find({ date: monthRegex });

  let totalRevenue = 0;
  let bookedCount = 0;
  let cancelledCount = 0;
  let noShowCount = 0;

  const dailyMap: Record<string, { revenue: number; bookedCount: number }> = {};
  const slotCountMap: Record<string, number> = {};

  for (const b of bookings) {
    if (b.status === "BOOKED") {
      bookedCount += 1;
      totalRevenue += b.price;

      if (!dailyMap[b.date]) {
        dailyMap[b.date] = { revenue: 0, bookedCount: 0 };
      }
      dailyMap[b.date]!.revenue += b.price;
      dailyMap[b.date]!.bookedCount += 1;

      slotCountMap[b.startTime] = (slotCountMap[b.startTime] || 0) + 1;
    } else if (b.status === "CANCELLED") {
      cancelledCount += 1;
    } else if (b.status === "NO_SHOW") {
      noShowCount += 1;
    }
  }

  // Build daily trend array
  const dailyTrend = Object.keys(dailyMap)
    .sort()
    .map((dateKey) => ({
      date: dateKey,
      revenue: dailyMap[dateKey]!.revenue,
      bookedCount: dailyMap[dateKey]!.bookedCount,
    }));

  // Build peak hours array
  const peakHours = Object.keys(slotCountMap)
    .map((time) => ({ startTime: time, bookingCount: slotCountMap[time]! }))
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 5);

  const totalEvaluated = bookedCount + cancelledCount + noShowCount;
  const cancellationRate = totalEvaluated > 0
    ? Math.round((cancelledCount / totalEvaluated) * 100 * 10) / 10
    : 0;
  const noShowRate = totalEvaluated > 0
    ? Math.round((noShowCount / totalEvaluated) * 100 * 10) / 10
    : 0;

  return {
    year,
    month,
    totalRevenue,
    totalBookingsCount: bookings.length,
    bookedCount,
    cancelledCount,
    noShowCount,
    dailyTrend,
    peakHours,
    cancellationRate,
    noShowRate,
  };
};

/**
 * Yearly Analytics Report
 */
export const getYearlyAnalytics = async (yearParam?: number): Promise<IYearlyAnalytics> => {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const year = yearParam || now.getUTCFullYear();
  const yearRegex = new RegExp(`^${year}`);

  const [bookings, totalCustomers, registeredCustomers] = await Promise.all([
    Booking.find({ date: yearRegex }),
    Customer.countDocuments(),
    Customer.countDocuments({ isRegistered: true }),
  ]);

  let totalRevenue = 0;
  let bookedCount = 0;

  const monthlyMap: Record<string, { revenue: number; bookedCount: number }> = {};

  for (const b of bookings) {
    if (b.status === "BOOKED") {
      bookedCount += 1;
      totalRevenue += b.price;

      const mKey = b.date.substring(0, 7); // "YYYY-MM"
      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = { revenue: 0, bookedCount: 0 };
      }
      monthlyMap[mKey]!.revenue += b.price;
      monthlyMap[mKey]!.bookedCount += 1;
    }
  }

  const monthlyTrend = Object.keys(monthlyMap)
    .sort()
    .map((mKey) => ({
      month: mKey,
      revenue: monthlyMap[mKey]!.revenue,
      bookedCount: monthlyMap[mKey]!.bookedCount,
    }));

  return {
    year,
    totalRevenue,
    totalBookingsCount: bookings.length,
    bookedCount,
    monthlyTrend,
    customerMetrics: {
      totalCustomers,
      registeredCustomers,
      guestCustomers: Math.max(0, totalCustomers - registeredCustomers),
    },
  };
};
