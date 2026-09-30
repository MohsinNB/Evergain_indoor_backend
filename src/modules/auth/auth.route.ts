import { Router } from "express";
import { adminLoginHandler, adminLogoutHandler, adminMeHandler } from "./auth.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

router.post("/auth/admin/login", adminLoginHandler);
router.post("/auth/admin/logout", adminLogoutHandler);
router.get("/auth/admin/me", adminAuthGuard, adminMeHandler);

export default router;
