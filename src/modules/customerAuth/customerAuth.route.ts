import { Router } from "express";
import {
  customerSignupHandler,
  customerLoginHandler,
  customerLogoutHandler,
  customerMeHandler,
} from "./customerAuth.controller";
import { customerAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

router.post("/auth/customer/signup", customerSignupHandler);
router.post("/auth/customer/login", customerLoginHandler);
router.post("/auth/customer/logout", customerLogoutHandler);
router.get("/auth/customer/me", customerAuthGuard, customerMeHandler);

export default router;
