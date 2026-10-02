import { Router } from "express";
import { sendOTPHandler, verifyOTPHandler } from "./otp.controller";

const router = Router();

// Public OTP endpoints
router.post("/otp/send", sendOTPHandler);
router.post("/otp/verify", verifyOTPHandler);

export default router;
