import jwt from "jsonwebtoken";
import { Response } from "express";
import Customer from "../customer/customer.model";
import { ICustomer } from "../customer/customer.interface";
import { CustomerSignupZodInput, CustomerLoginZodInput, CustomerResetPasswordZodInput } from "../customer/customer.validation";
import { verifyOTPService } from "../otp/otp.service";
import { awardProfileCompletionCoupon } from "../discountCoupon/discountCoupon.service";
import config from "../../config";
import CustomError from "../../helpers/CustomError";

/**
 * Register a customer account (or upgrade a guest record).
 */
export const registerCustomer = async (
  data: CustomerSignupZodInput,
  res: Response,
): Promise<{ customer: Partial<ICustomer>; token: string }> => {
  // Verify OTP for chosen channel (sms or email)
  await verifyOTPService({
    channel: data.otpChannel ?? "sms",
    phone: data.phone,
    email: data.email,
    otp: data.otp,
    purpose: "signup",
  });

  let customer = await Customer.findOne({ phone: data.phone });

  if (customer && customer.isRegistered) {
    throw new CustomError(400, "An account with this phone number already exists. Please login.");
  }

  // Check duplicate email if email is provided
  if (data.email) {
    const existingEmail = await Customer.findOne({
      email: data.email.toLowerCase().trim(),
      _id: customer ? { $ne: customer._id } : { $exists: true },
    });
    if (existingEmail) {
      throw new CustomError(400, "An account with this email address already exists.");
    }
  }

  if (customer && !customer.isRegistered) {
    // Upgrade existing guest customer to registered user
    customer.name = data.name;
    if (data.email) customer.email = data.email;
    customer.passwordHash = data.password;
    customer.isRegistered = true;
    await customer.save();
  } else {
    // Create new customer
    const createPayload: Record<string, any> = {
      name: data.name,
      phone: data.phone,
      passwordHash: data.password,
      isRegistered: true,
    };
    if (data.email) {
      createPayload["email"] = data.email;
    }
    customer = await Customer.create(createPayload);
  }

  // Award ৳50 Profile Completion Coupon if eligible (registered, email present, totalBookings >= 1)
  await awardProfileCompletionCoupon(String(customer._id));

  // Generate Customer JWT
  const token = jwt.sign(
    {
      customerId: String(customer._id),
      phone: customer.phone,
    },
    config.jwt.customerSecret,
    {
      expiresIn: config.jwt.customerExpire as any,
    },
  );

  // Automatically award ৳50 profile completion coupon if eligible
  await awardProfileCompletionCoupon(String(customer._id));

  // Set httpOnly cookie
  res.cookie("customerToken", token, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const customerResponse: Partial<ICustomer> = {
    _id: customer._id,
    name: customer.name,
    phone: customer.phone,
    isRegistered: customer.isRegistered,
    totalBookings: customer.totalBookings,
  };
  if (customer.email) {
    customerResponse.email = customer.email;
  }

  return {
    customer: customerResponse,
    token,
  };
};

/**
 * Login registered customer.
 */
export const loginCustomer = async (
  data: CustomerLoginZodInput,
  res: Response,
): Promise<{ customer: Partial<ICustomer>; token: string }> => {
  const isEmail = data.identifier.includes("@");
  const query = isEmail
    ? { email: data.identifier.toLowerCase().trim() }
    : { phone: data.identifier.trim() };

  const customer = await Customer.findOne(query).select("+passwordHash");
  if (!customer || !customer.isRegistered) {
    throw new CustomError(401, "Invalid phone number/email or password.");
  }

  const isMatch = await customer.comparePassword(data.password);
  if (!isMatch) {
    throw new CustomError(401, "Invalid phone number/email or password.");
  }

  // Generate Customer JWT
  const token = jwt.sign(
    {
      customerId: String(customer._id),
      phone: customer.phone,
    },
    config.jwt.customerSecret,
    {
      expiresIn: config.jwt.customerExpire as any,
    },
  );

  // Automatically award ৳50 profile completion coupon if eligible
  await awardProfileCompletionCoupon(String(customer._id));

  // Set httpOnly cookie
  res.cookie("customerToken", token, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const customerResponse: Partial<ICustomer> = {
    _id: customer._id,
    name: customer.name,
    phone: customer.phone,
    isRegistered: customer.isRegistered,
    totalBookings: customer.totalBookings,
  };
  if (customer.email) {
    customerResponse.email = customer.email;
  }

  return {
    customer: customerResponse,
    token,
  };
};

/**
 * Logout customer by clearing cookie.
 */
export const logoutCustomer = (res: Response): void => {
  res.clearCookie("customerToken", {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
  });
};

/**
 * Reset customer password using OTP verification.
 */
export const resetCustomerPassword = async (
  data: CustomerResetPasswordZodInput,
): Promise<{ message: string }> => {
  const identifier = data.identifier.trim();
  const isEmail = identifier.includes("@");

  const query = isEmail
    ? { email: identifier.toLowerCase(), isRegistered: true }
    : { phone: identifier, isRegistered: true };

  const customer = await Customer.findOne(query);
  if (!customer) {
    throw new CustomError(404, "No registered account found with this phone number or email address.");
  }

  // Verify OTP for reset_password
  await verifyOTPService({
    channel: data.otpChannel ?? (isEmail ? "email" : "sms"),
    phone: isEmail ? undefined : customer.phone,
    email: isEmail ? customer.email : undefined,
    otp: data.otp,
    purpose: "reset_password",
  });

  customer.passwordHash = data.newPassword;
  await customer.save();

  return {
    message: "Password updated successfully. Please login with your new password.",
  };
};
