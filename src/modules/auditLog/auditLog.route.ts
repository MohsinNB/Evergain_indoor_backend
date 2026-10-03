import { Router } from "express";
import { getAuditLogsHandler } from "./auditLog.controller";
import { adminAuthGuard } from "../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/v1/audit-logs
 * Admin: View system audit logs.
 */
router.get("/audit-logs", adminAuthGuard, getAuditLogsHandler);

export default router;
