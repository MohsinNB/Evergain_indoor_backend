import { Request, Response, NextFunction } from "express";
import { getAuditLogs } from "./auditLog.service";

/**
 * GET /api/v1/audit-logs
 * Admin: View system audit logs with filters & pagination.
 */
export const getAuditLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { action, actorId, startDate, endDate, page, limit } = req.query;

    const queryFilter: {
      action?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {};

    if (action) queryFilter.action = String(action);
    if (actorId) queryFilter.actorId = String(actorId);
    if (startDate) queryFilter.startDate = String(startDate);
    if (endDate) queryFilter.endDate = String(endDate);
    if (page) queryFilter.page = Number(page);
    if (limit) queryFilter.limit = Number(limit);

    const result = await getAuditLogs(queryFilter);

    res.status(200).json({
      success: true,
      message: "Audit logs fetched successfully.",
      data: result.logs,
      meta: {
        total: result.total,
        page: queryFilter.page || 1,
        limit: queryFilter.limit || 50,
      },
    });
  } catch (error) {
    next(error);
  }
};
