import Customer from "./customer.model";
import { ICustomer } from "./customer.interface";
import { UpdateCustomerProfileZodInput } from "./customer.validation";
import DiscountCoupon from "../discountCoupon/discountCoupon.model";
import { IDiscountCoupon } from "../discountCoupon/discountCoupon.interface";
import CustomError from "../../helpers/CustomError";

/**
 * Get customer profile by ID.
 */
export const getCustomerProfile = async (customerId: string): Promise<ICustomer> => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new CustomError(404, "Customer not found.");
  }
  return customer;
};

/**
 * Update customer profile.
 * If customer completes profile (adds email for the first time) after having completed a booking,
 * issues a ৳50 profile completion coupon if not already issued.
 */
export const updateCustomerProfile = async (
  customerId: string,
  data: UpdateCustomerProfileZodInput,
): Promise<{ customer: ICustomer; couponAwarded: boolean }> => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new CustomError(404, "Customer not found.");
  }

  const wasEmailMissing = !customer.email;

  if (data.name !== undefined) customer.name = data.name;
  if (data.email !== undefined) customer.email = data.email;

  await customer.save();

  let couponAwarded = false;

  // Check if eligible for ৳50 profile completion coupon (if email just added & has bookings & no coupon yet)
  if (wasEmailMissing && customer.email && customer.totalBookings > 0) {
    const existingCoupon = await DiscountCoupon.findOne({
      customerId: customer._id,
      type: "profile_completion",
    });

    if (!existingCoupon) {
      await DiscountCoupon.create({
        customerId: customer._id,
        type: "profile_completion",
        amountType: "fixed",
        amountValue: 50, // ৳50 off
        isUsed: false,
      });
      couponAwarded = true;
    }
  }

  return { customer, couponAwarded };
};

/**
 * Get active unused discount coupons for customer.
 */
export const getCustomerCoupons = async (customerId: string): Promise<IDiscountCoupon[]> => {
  return DiscountCoupon.find({
    customerId,
    isUsed: false,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  }).sort({ createdAt: -1 });
};
