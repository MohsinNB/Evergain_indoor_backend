import DiscountCoupon from "./discountCoupon.model";
import { IDiscountCoupon } from "./discountCoupon.interface";
import Customer from "../customer/customer.model";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";

/**
 * Check eligibility & award ৳50 Profile Completion Coupon to customer.
 * Eligible if: registered, has email, and totalBookings >= 1 (has completed a booking), and coupon not awarded before.
 */
export const awardProfileCompletionCoupon = async (
  customerId: string,
): Promise<{ awarded: boolean; coupon?: IDiscountCoupon }> => {
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.isRegistered || !customer.email || customer.totalBookings < 1) {
    return { awarded: false };
  }

  // Check if coupon already awarded
  const existingCoupon = await DiscountCoupon.findOne({
    customerId: customer._id,
    type: "profile_completion",
  });

  if (existingCoupon) {
    return { awarded: false, coupon: existingCoupon };
  }

  // Issue ৳50 profile completion coupon (valid for 30 days)
  const coupon = await DiscountCoupon.create({
    customerId: customer._id,
    type: "profile_completion",
    amountType: "fixed",
    amountValue: 50,
    isUsed: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
  });

  return { awarded: true, coupon };
};

/**
 * Validate customer coupon by ID
 */
export const validateCustomerCoupon = async (
  couponId: string,
  customerId: string,
): Promise<IDiscountCoupon> => {
  const coupon = await DiscountCoupon.findOne({
    _id: couponId,
    customerId,
  });

  if (!coupon) {
    throw new CustomError(404, "Discount coupon not found.");
  }

  if (coupon.isUsed) {
    throw new CustomError(400, "This discount coupon has already been used.");
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CustomError(400, "This discount coupon has expired.");
  }

  return coupon;
};

/**
 * Mark a coupon as used upon successful booking payment confirmation
 */
export const markCouponAsUsed = async (
  couponId: string,
  bookingId: string,
): Promise<IDiscountCoupon | null> => {
  const coupon = await DiscountCoupon.findById(couponId);
  if (!coupon || coupon.isUsed) {
    return null;
  }

  coupon.isUsed = true;
  coupon.usedInBookingId = new Types.ObjectId(bookingId);
  await coupon.save();

  return coupon;
};
