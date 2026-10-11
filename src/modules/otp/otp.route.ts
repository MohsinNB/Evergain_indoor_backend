import { Router } from "express";
import { sendOTPHandler, verifyOTPHandler } from "./otp.controller";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Public OTP endpoints (rate limited: SMS costs money and OTPs can be brute-forced)
router.post("/otp/send", rateLimiter(15, 5), sendOTPHandler);
router.post("/otp/verify", rateLimiter(15, 10), verifyOTPHandler);

export default router;
