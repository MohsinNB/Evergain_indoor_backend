import { Router } from "express";
import { adminLoginHandler, adminLogoutHandler, adminMeHandler } from "./auth.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.post("/auth/admin/login", rateLimiter(15, 5), adminLoginHandler);
router.post("/auth/admin/logout", adminLogoutHandler);
router.get("/auth/admin/me", adminAuthGuard, adminMeHandler);

export default router;
