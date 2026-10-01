import { Router } from "express";
import {
  getProfileHandler,
  updateProfileHandler,
  getCouponsHandler,
} from "./customer.controller";
import { customerAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

router.get("/customer/profile", customerAuthGuard, getProfileHandler);
router.patch("/customer/profile", customerAuthGuard, updateProfileHandler);
router.get("/customer/coupons", customerAuthGuard, getCouponsHandler);

export default router;
