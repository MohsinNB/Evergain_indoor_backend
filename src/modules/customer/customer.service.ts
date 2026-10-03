import Customer from "./customer.model";
import { ICustomer } from "./customer.interface";
import { UpdateCustomerProfileZodInput } from "./customer.validation";
import DiscountCoupon from "../discountCoupon/discountCoupon.model";
import { IDiscountCoupon } from "../discountCoupon/discountCoupon.interface";
import { awardProfileCompletionCoupon } from "../discountCoupon/discountCoupon.service";
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

  if (data.email !== undefined) {
    const existingEmail = await Customer.findOne({
      email: data.email.toLowerCase().trim(),
      _id: { $ne: customer._id },
    });
    if (existingEmail) {
      throw new CustomError(400, "An account with this email address already exists.");
    }
    customer.email = data.email;
  }
  if (data.name !== undefined) customer.name = data.name;

  await customer.save();

  const { awarded: couponAwarded } = await awardProfileCompletionCoupon(String(customer._id));

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

/**
 * Get list of all customers for Admin management (with search/pagination).
 */
export const getAllCustomersForAdmin = async (query: {
  search?: string;
  isRegistered?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ customers: ICustomer[]; total: number }> => {
  const filter: Record<string, any> = {};

  if (query.isRegistered !== undefined) {
    filter["isRegistered"] = query.isRegistered;
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");
    filter["$or"] = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  return { customers, total };
};
