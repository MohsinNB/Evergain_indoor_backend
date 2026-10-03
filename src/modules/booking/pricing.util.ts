import { IAppliedDiscount } from "./booking.interface";
import { IDiscountCoupon } from "../discountCoupon/discountCoupon.interface";

export const EARLY_BIRD_DISCOUNT_AMOUNT = 50;

/**
 * Checks whether a slot (date + startTime in Asia/Dhaka wall-clock time)
 * starts within 48 hours from current system time.
 */
export const isWithin48HourWindow = (slotDate: string, slotStartTime: string): boolean => {
  const nowMs = Date.now();
  const thresholdMs = nowMs + 48 * 60 * 60 * 1000;

  const dateParts = slotDate.split("-").map(Number);
  const timeParts = slotStartTime.split(":").map(Number);

  const year = dateParts[0] ?? 0;
  const month = dateParts[1] ?? 1;
  const day = dateParts[2] ?? 1;
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;

  // Asia/Dhaka is UTC+6
  const slotUtcMs = Date.UTC(year, month - 1, day, hour - 6, minute);

  return slotUtcMs <= thresholdMs;
};

/**
 * Calculates final price and applied discount for a booking slot.
 * Enforces rule: Maximum 1 discount per booking (largest single discount wins).
 */
export const calculateBookingPrice = (
  pricePerSlot: number,
  slotDate: string,
  slotStartTime: string,
  coupon?: IDiscountCoupon | null,
): { price: number; appliedDiscount: IAppliedDiscount; appliedCouponId?: string } => {
  const within48h = isWithin48HourWindow(slotDate, slotStartTime);
  const earlyBirdDiscount = within48h ? Math.min(EARLY_BIRD_DISCOUNT_AMOUNT, pricePerSlot) : 0;

  let couponDiscount = 0;
  if (coupon && !coupon.isUsed) {
    if (coupon.amountType === "fixed") {
      couponDiscount = Math.min(coupon.amountValue, pricePerSlot);
    } else if (coupon.amountType === "percentage") {
      couponDiscount = Math.min(
        Math.round((pricePerSlot * coupon.amountValue) / 100),
        pricePerSlot,
      );
    }
  }

  // Enforce rule: Single largest discount wins
  if (couponDiscount > earlyBirdDiscount && coupon) {
    const finalPrice = Math.max(0, pricePerSlot - couponDiscount);
    const discountType =
      coupon.type === "profile_completion" ? "profile_completion" : "profile_completion";

    return {
      price: finalPrice,
      appliedDiscount: {
        type: discountType as any,
        amount: couponDiscount,
      },
      appliedCouponId: String(coupon._id),
    };
  }

  if (earlyBirdDiscount > 0) {
    const finalPrice = Math.max(0, pricePerSlot - earlyBirdDiscount);
    return {
      price: finalPrice,
      appliedDiscount: {
        type: "48h_early_bird",
        amount: earlyBirdDiscount,
      },
    };
  }

  return {
    price: pricePerSlot,
    appliedDiscount: {
      type: "none",
      amount: 0,
    },
  };
};
