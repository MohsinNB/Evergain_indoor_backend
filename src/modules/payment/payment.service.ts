import Booking from "../booking/booking.model";
import Customer from "../customer/customer.model";
import {
  validateSSLCommerzPayment,
  isMockPaymentMode,
  SSLCommerzValidationResponse,
} from "./sslcommerz.service";
import { awardProfileCompletionCoupon, markCouponAsUsed } from "../discountCoupon/discountCoupon.service";
import CustomError from "../../helpers/CustomError";
import config from "../../config";

export interface SSLCommerzCallbackResult {
  booking?: any;
  alreadyProcessed?: boolean;
  isFirstBooking?: boolean;
  redirectUrl: string;
}

const isValidGatewayStatus = (status?: string): boolean =>
  status === "VALID" || status === "VALIDATED";

const successRedirect = (tranId: string, bookingId: unknown): string =>
  `${config.frontendUrl}/booking/success?tran_id=${encodeURIComponent(tranId)}&booking_id=${bookingId}`;

/**
 * Server-to-server check that a gateway payment really belongs to this booking and
 * covers its price. A val_id from the browser/IPN is NEVER trusted on its own.
 */
const assertGatewayPaymentIsGenuine = async (
  booking: { price: number; payment: { tranId?: string | undefined } },
  valId: string | undefined,
): Promise<SSLCommerzValidationResponse | null> => {
  // No gateway configured => simulator mode (no real money). Nothing to validate.
  if (isMockPaymentMode()) return null;

  if (!valId) {
    throw new CustomError(400, "Missing val_id: payment cannot be verified.");
  }

  const val = await validateSSLCommerzPayment(valId);

  if (!isValidGatewayStatus(val.status)) {
    throw new CustomError(400, `SSLCommerz payment validation failed. Status: ${val.status}`);
  }
  if (val.tran_id !== booking.payment.tranId) {
    throw new CustomError(400, "Payment transaction does not match this booking.");
  }
  const paid = Number(val.amount);
  const currency = val.currency_type ?? val.currency;
  if (!Number.isFinite(paid) || paid + 0.5 < booking.price) {
    throw new CustomError(400, "Paid amount is less than the booking price.");
  }
  if (currency && currency !== "BDT") {
    throw new CustomError(400, "Unexpected payment currency.");
  }
  return val;
};

/**
 * Atomically moves a booking PENDING|EXPIRED -> BOOKED exactly once.
 * Concurrent success-redirect + IPN calls race here: only one wins, so customer
 * counters / coupons are never double-applied.
 */
const confirmPaidBooking = async (
  tranId: string,
  valId: string | undefined,
  cardType: string | undefined,
): Promise<{ booking: any; alreadyProcessed: boolean; isFirstBooking: boolean }> => {
  const booking = await Booking.findOne({ "payment.tranId": tranId });
  if (!booking) {
    throw new CustomError(404, "Booking not found for this transaction.");
  }

  // Idempotency: already confirmed
  if (booking.status === "BOOKED") {
    return { booking, alreadyProcessed: true, isFirstBooking: false };
  }

  if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
    throw new CustomError(409, `Booking is ${booking.status.toLowerCase()} and cannot be confirmed.`);
  }

  await assertGatewayPaymentIsGenuine(booking, valId);

  const $set: Record<string, unknown> = {
    status: "BOOKED",
    confirmedAt: new Date(),
    "payment.status": "paid",
    "payment.paidAt": new Date(),
  };
  if (valId) $set["payment.valId"] = valId;
  if (cardType) $set["payment.cardType"] = cardType;

  let updated;
  try {
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: { $in: ["PENDING", "EXPIRED"] } },
      { $set, $unset: { holdExpiresAt: 1 } },
      { new: true },
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      // Paid after the hold expired and someone else grabbed the slot meanwhile.
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            "payment.status": "paid",
            "payment.paidAt": new Date(),
            cancelReason: "PAID AFTER HOLD EXPIRED - SLOT TAKEN. REFUND REQUIRED.",
          },
        },
      );
      console.error(`[Payment] REFUND REQUIRED: tran_id=${tranId} paid but slot is no longer free.`);
      throw new CustomError(
        409,
        "Your payment was received but the slot was taken in the meantime. Please contact us for a refund.",
      );
    }
    throw error;
  }

  if (!updated) {
    // Lost the race: another callback already confirmed it.
    const current = await Booking.findById(booking._id);
    return { booking: current ?? booking, alreadyProcessed: true, isFirstBooking: false };
  }

  // From here on only the single winner runs side effects.
  if (updated.appliedDiscount?.couponId) {
    await markCouponAsUsed(String(updated.appliedDiscount.couponId), String(updated._id));
  }

  let isFirstBooking = false;
  if (updated.customerId) {
    const customer = await Customer.findByIdAndUpdate(
      updated.customerId,
      { $inc: { totalBookings: 1 } },
      { new: true },
    );
    if (customer) {
      isFirstBooking = customer.totalBookings === 1;
      await awardProfileCompletionCoupon(String(customer._id));
    }
  }

  return { booking: updated, alreadyProcessed: false, isFirstBooking };
};

/**
 * Releases a PENDING hold immediately when the customer fails/cancels the checkout,
 * so the slot (and their one-pending-booking-per-phone allowance) is free right away.
 */
const releaseHold = async (tranId: string): Promise<void> => {
  await Booking.updateOne(
    { "payment.tranId": tranId, status: "PENDING", "payment.status": "pending" },
    { $set: { status: "EXPIRED", "payment.status": "failed" }, $unset: { holdExpiresAt: 1 } },
  );
};

/**
 * Handle SSLCommerz Success Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzSuccess = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = String(payload.tran_id || payload.tranId || "");
  const valId = payload.val_id || payload.valId;

  if (!tranId) {
    throw new CustomError(400, "Transaction ID (tran_id) is missing in payload.");
  }

  const { booking, alreadyProcessed, isFirstBooking } = await confirmPaidBooking(
    tranId,
    valId ? String(valId) : undefined,
    payload.card_type ? String(payload.card_type) : undefined,
  );

  return {
    booking,
    alreadyProcessed,
    isFirstBooking,
    redirectUrl: successRedirect(tranId, booking._id),
  };
};

/**
 * Handle SSLCommerz Fail Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzFail = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = String(payload.tran_id || payload.tranId || "");

  if (tranId) await releaseHold(tranId);

  return {
    redirectUrl: `${config.frontendUrl}/booking/failed?tran_id=${encodeURIComponent(tranId)}`,
  };
};

/**
 * Handle SSLCommerz Cancel Callback (Browser Redirect via POST)
 */
export const handleSSLCommerzCancel = async (
  payload: Record<string, any>,
): Promise<SSLCommerzCallbackResult> => {
  const tranId = String(payload.tran_id || payload.tranId || "");

  if (tranId) await releaseHold(tranId);

  return {
    redirectUrl: `${config.frontendUrl}/booking/cancelled?tran_id=${encodeURIComponent(tranId)}`,
  };
};

/**
 * Handle Server-to-Server IPN Callback from SSLCommerz
 */
export const handleSSLCommerzIPN = async (
  payload: Record<string, any>,
): Promise<{ success: boolean; message: string; bookingId?: string }> => {
  const tranId = String(payload.tran_id || payload.tranId || "");
  const valId = payload.val_id || payload.valId;
  const status = payload.status;

  if (!tranId) {
    return { success: false, message: "Missing tran_id in IPN payload" };
  }

  const existing = await Booking.findOne({ "payment.tranId": tranId });
  if (!existing) {
    return { success: false, message: "Booking not found for this transaction." };
  }

  // Idempotency check: already BOOKED => acknowledge, no reprocessing / no duplicate audit
  if (existing.status === "BOOKED") {
    return {
      success: true,
      message: "IPN acknowledged. Booking already marked as BOOKED.",
      bookingId: String(existing._id),
    };
  }

  if (!isValidGatewayStatus(status)) {
    if (existing.status === "PENDING") await releaseHold(tranId);
    return { success: false, message: `IPN status is ${status}, not valid.` };
  }

  try {
    const { booking } = await confirmPaidBooking(
      tranId,
      valId ? String(valId) : undefined,
      payload.card_type ? String(payload.card_type) : undefined,
    );
    return {
      success: true,
      message: "IPN processed successfully. Booking confirmed.",
      bookingId: String(booking._id),
    };
  } catch (error: any) {
    if (error instanceof CustomError) {
      return { success: false, message: error.message };
    }
    throw error;
  }
};
