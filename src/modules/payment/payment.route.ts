import { Router } from "express";
import {
  sslCommerzSuccessHandler,
  sslCommerzFailHandler,
  sslCommerzCancelHandler,
  sslCommerzIPNHandler,
} from "./payment.controller";

const router = Router();

// SSLCommerz Payment Gateway Callbacks

/**
 * POST /api/v1/payment/sslcommerz/success
 * SSLCommerz redirects user browser here upon success.
 */
router.post("/payment/sslcommerz/success", sslCommerzSuccessHandler);
router.get("/payment/sslcommerz/success", sslCommerzSuccessHandler);

/**
 * POST /api/v1/payment/sslcommerz/fail
 * SSLCommerz redirects user browser here upon failure.
 */
router.post("/payment/sslcommerz/fail", sslCommerzFailHandler);
router.get("/payment/sslcommerz/fail", sslCommerzFailHandler);

/**
 * POST /api/v1/payment/sslcommerz/cancel
 * SSLCommerz redirects user browser here upon cancellation.
 */
router.post("/payment/sslcommerz/cancel", sslCommerzCancelHandler);
router.get("/payment/sslcommerz/cancel", sslCommerzCancelHandler);

/**
 * POST /api/v1/payment/sslcommerz/ipn
 * Server-to-Server IPN Callback from SSLCommerz.
 */
router.post("/payment/sslcommerz/ipn", sslCommerzIPNHandler);

export default router;
