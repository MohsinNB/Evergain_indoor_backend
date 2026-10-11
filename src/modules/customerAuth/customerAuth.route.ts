import { Router } from "express";
import {
  customerSignupHandler,
  customerLoginHandler,
  customerLogoutHandler,
  customerMeHandler,
  customerResetPasswordHandler,
} from "./customerAuth.controller";
import { customerAuthGuard } from "../../middleware/auth.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.post("/auth/customer/signup", rateLimiter(15, 10), customerSignupHandler);
router.post("/auth/customer/login", rateLimiter(15, 10), customerLoginHandler);
router.post("/auth/customer/logout", customerLogoutHandler);
router.post("/auth/customer/reset-password", rateLimiter(15, 5), customerResetPasswordHandler);
router.get("/auth/customer/me", customerAuthGuard, customerMeHandler);

export default router;
