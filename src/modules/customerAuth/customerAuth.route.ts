import { Router } from "express";
import {
  customerSignupHandler,
  customerLoginHandler,
  customerLogoutHandler,
  customerMeHandler,
  customerResetPasswordHandler,
} from "./customerAuth.controller";
import { customerAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

router.post("/auth/customer/signup", customerSignupHandler);
router.post("/auth/customer/login", customerLoginHandler);
router.post("/auth/customer/logout", customerLogoutHandler);
router.post("/auth/customer/reset-password", customerResetPasswordHandler);
router.get("/auth/customer/me", customerAuthGuard, customerMeHandler);

export default router;
