import { Request, Response, NextFunction } from "express";
import {
  handleSSLCommerzSuccess,
  handleSSLCommerzFail,
  handleSSLCommerzCancel,
  handleSSLCommerzIPN,
} from "./payment.service";

/**
 * POST /api/v1/payment/sslcommerz/success
 * SSLCommerz redirects browser here upon successful payment.
 */
export const sslCommerzSuccessHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await handleSSLCommerzSuccess(payload);

    // If client explicitly requests JSON (e.g. Postman test), return JSON object
    if (
      req.headers.accept?.includes("application/json") ||
      req.query["json"] === "true"
    ) {
      res.status(200).json({
        success: true,
        message: "Payment validated and booking confirmed successfully.",
        data: result,
      });
      return;
    }

    // Default: Redirect browser to Frontend Success Page
    res.redirect(result.redirectUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/payment/sslcommerz/fail
 * SSLCommerz redirects browser here when payment fails.
 */
export const sslCommerzFailHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await handleSSLCommerzFail(payload);

    if (
      req.headers.accept?.includes("application/json") ||
      req.query["json"] === "true"
    ) {
      res.status(200).json({
        success: false,
        message: "Payment failed.",
        data: result,
      });
      return;
    }

    res.redirect(result.redirectUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/payment/sslcommerz/cancel
 * SSLCommerz redirects browser here when payment is cancelled.
 */
export const sslCommerzCancelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await handleSSLCommerzCancel(payload);

    if (
      req.headers.accept?.includes("application/json") ||
      req.query["json"] === "true"
    ) {
      res.status(200).json({
        success: false,
        message: "Payment cancelled by user.",
        data: result,
      });
      return;
    }

    res.redirect(result.redirectUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/payment/sslcommerz/ipn
 * Server-to-Server IPN Callback Endpoint from SSLCommerz.
 */
export const sslCommerzIPNHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await handleSSLCommerzIPN(payload);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        bookingId: result.bookingId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    next(error);
  }
};
