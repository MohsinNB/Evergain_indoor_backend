import { Router } from "express";
import {
  seedAdminHandler,
  getAdminsHandler,
  createAdminHandler,
  updateAdminHandler,
} from "./admin.controller";
import { adminAuthGuard, requireRole } from "../../middleware/auth.middleware";

const router = Router();

// Public seed endpoint (works only when 0 admins exist)
router.post("/admins/seed", seedAdminHandler);

// Protected super_admin endpoints
router.get("/admins", adminAuthGuard, requireRole("super_admin"), getAdminsHandler);
router.post("/admins", adminAuthGuard, requireRole("super_admin"), createAdminHandler);
router.patch("/admins/:id", adminAuthGuard, requireRole("super_admin"), updateAdminHandler);

export default router;
