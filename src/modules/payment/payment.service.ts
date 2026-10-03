import Booking from "../booking/booking.model";
import Customer from "../customer/customer.model";
import { validateSSLCommerzPayment } from "./sslcommerz.service";
import { awardProfileCompletionCoupon, markCouponAsUsed } from "../discountCoupon/discountCoupon.service";
import CustomError from "../../helpers/CustomError";
import config from "../../config";

export interface SSLCommerzCallbackResult {
  booking?: any;
  alreadyProcessed?: boolean;
  isFirstBooking?: boolean;
  redirectUrl: string;
}

/**
 * Handle SSLCommerz Success Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzSuccess = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = payload.tran_id || payload.tranId;
  const valId = payload.val_id || payload.valId;

  if (!tranId) {
    throw new CustomError(400, "Transaction ID (tran_id) is missing in payload.");
  }

  const booking = await Booking.findOne({ "payment.tranId": tranId });
  if (!booking) {
    throw new CustomError(404, `Booking not found for transaction ID: ${tranId}`);
  }

  // Idempotency check: If already BOOKED, acknowledge without re-processing
  if (booking.status === "BOOKED") {
    return {
      booking,
      alreadyProcessed: true,
      redirectUrl: `${config.frontendUrl}/booking/success?tran_id=${tranId}&booking_id=${booking._id}`,
    };
  }

  // Server-to-Server Validation Call with SSLCommerz API
  if (valId) {
    const valResult = await validateSSLCommerzPayment(valId);
    if (valResult.status !== "VALID" && valResult.status !== "VALIDATED") {
      throw new CustomError(400, `SSLCommerz payment validation failed. Status: ${valResult.status}`);
    }
  }

  // Update Booking Status to BOOKED
  booking.status = "BOOKED";
  booking.confirmedAt = new Date();
  booking.holdExpiresAt = undefined; // Remove 15-min TTL hold
  booking.payment.status = "paid";
  if (valId) booking.payment.valId = valId;
  if (payload.card_type) booking.payment.cardType = payload.card_type;
  booking.payment.paidAt = new Date();

  await booking.save();

  // Mark applied coupon as used if present
  if (booking.appliedDiscount?.couponId) {
    await markCouponAsUsed(String(booking.appliedDiscount.couponId), String(booking._id));
  }

  // Increment customer booking count and check profile completion coupon eligibility
  let isFirstBooking = false;
  if (booking.customerId) {
    const customer = await Customer.findById(booking.customerId);
    if (customer) {
      customer.totalBookings += 1;
      await customer.save();
      isFirstBooking = customer.totalBookings === 1;

      // Automatically award ৳50 Profile Completion Coupon if eligible
      await awardProfileCompletionCoupon(String(customer._id));
    }
  }

  return {
    booking,
    alreadyProcessed: false,
    isFirstBooking,
    redirectUrl: `${config.frontendUrl}/booking/success?tran_id=${tranId}&booking_id=${booking._id}`,
  };
};

/**
 * Handle SSLCommerz Fail Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzFail = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = payload.tran_id || payload.tranId;

  if (tranId) {
    const booking = await Booking.findOne({ "payment.tranId": tranId });
    if (booking && booking.status === "PENDING") {
      booking.payment.status = "failed";
      await booking.save();
    }
  }

  return {
    redirectUrl: `${config.frontendUrl}/booking/failed?tran_id=${tranId || ""}`,
  };
};

/**
 * Handle SSLCommerz Cancel Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzCancel = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = payload.tran_id || payload.tranId;

  if (tranId) {
    const booking = await Booking.findOne({ "payment.tranId": tranId });
    if (booking && booking.status === "PENDING") {
      booking.payment.status = "failed";
      await booking.save();
    }
  }

  return {
    redirectUrl: `${config.frontendUrl}/booking/cancelled?tran_id=${tranId || ""}`,
  };
};

/**
 * Handle Server-to-Server IPN Callback from SSLCommerz
 */
export const handleSSLCommerzIPN = async (
  payload: Record<string, any>,
): Promise<{ success: boolean; message: string; bookingId?: string }> => {
  const tranId = payload.tran_id || payload.tranId;
  const valId = payload.val_id || payload.valId;
  const status = payload.status;

  if (!tranId) {
    return { success: false, message: "Missing tran_id in IPN payload" };
  }

  const booking = await Booking.findOne({ "payment.tranId": tranId });
  if (!booking) {
    return { success: false, message: `Booking not found for tran_id: ${tranId}` };
  }

  // Idempotency check: If already BOOKED, acknowledge without re-processing
  if (booking.status === "BOOKED") {
    return {
      success: true,
      message: "IPN acknowledged. Booking already marked as BOOKED.",
      bookingId: String(booking._id),
    };
  }

  if (status !== "VALID" && status !== "VALIDATED") {
    booking.payment.status = "failed";
    await booking.save();
    return { success: false, message: `IPN status is ${status}, not valid.` };
  }

  // Validate server-to-server with SSLCommerz API
  if (valId) {
    const valResult = await validateSSLCommerzPayment(valId);
    if (valResult.status !== "VALID" && valResult.status !== "VALIDATED") {
      booking.payment.status = "failed";
      await booking.save();
      return { success: false, message: "Server-to-server IPN validation failed" };
    }
  }

  // Update Booking Status to BOOKED
  booking.status = "BOOKED";
  booking.confirmedAt = new Date();
  booking.holdExpiresAt = undefined;
  booking.payment.status = "paid";
  if (valId) booking.payment.valId = valId;
  if (payload.card_type) booking.payment.cardType = payload.card_type;
  booking.payment.paidAt = new Date();

  await booking.save();

  // Mark applied coupon as used if present
  if (booking.appliedDiscount?.couponId) {
    await markCouponAsUsed(String(booking.appliedDiscount.couponId), String(booking._id));
  }

  // Increment customer booking count and check profile completion coupon eligibility
  if (booking.customerId) {
    const customer = await Customer.findById(booking.customerId);
    if (customer) {
      customer.totalBookings += 1;
      await customer.save();

      // Automatically award ৳50 Profile Completion Coupon if eligible
      await awardProfileCompletionCoupon(String(customer._id));
    }
  }

  return {
    success: true,
    message: "IPN processed successfully. Booking confirmed.",
    bookingId: String(booking._id),
  };
};
