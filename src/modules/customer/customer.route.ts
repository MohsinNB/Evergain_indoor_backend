import { Router } from "express";
import {
  getProfileHandler,
  updateProfileHandler,
  getCouponsHandler,
  getCustomersForAdminHandler,
} from "./customer.controller";
import { customerAuthGuard, adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

// Customer routes
router.get("/customer/profile", customerAuthGuard, getProfileHandler);
router.patch("/customer/profile", customerAuthGuard, updateProfileHandler);
router.get("/customer/coupons", customerAuthGuard, getCouponsHandler);

// Admin route: List all customers (registered and guest)
router.get("/customers", adminAuthGuard, getCustomersForAdminHandler);

export default router;
