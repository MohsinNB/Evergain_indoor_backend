export interface IDailyAnalytics {
  date: string;
  totalRevenue: number;
  totalBookingsCount: number;
  bookedCount: number;
  cancelledCount: number;
  noShowCount: number;
  pendingCount: number;
  paymentMethodBreakdown: {
    gateway: { count: number; revenue: number };
    admin_manual: { count: number; revenue: number };
  };
  occupancyRate: number; // Percentage of slots booked for that date
}

export interface IMonthlyAnalytics {
  year: number;
  month: number;
  totalRevenue: number;
  totalBookingsCount: number;
  bookedCount: number;
  cancelledCount: number;
  noShowCount: number;
  dailyTrend: Array<{
    date: string;
    revenue: number;
    bookedCount: number;
  }>;
  peakHours: Array<{
    startTime: string;
    bookingCount: number;
  }>;
  cancellationRate: number;
  noShowRate: number;
}

export interface IYearlyAnalytics {
  year: number;
  totalRevenue: number;
  totalBookingsCount: number;
  bookedCount: number;
  monthlyTrend: Array<{
    month: string; // "YYYY-MM"
    revenue: number;
    bookedCount: number;
  }>;
  customerMetrics: {
    totalCustomers: number;
    registeredCustomers: number;
    guestCustomers: number;
  };
}
