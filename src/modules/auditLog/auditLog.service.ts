import AuditLog from "./auditLog.model";
import { IAuditLog, CreateAuditLogParams } from "./auditLog.interface";

/**
 * Log an audit action asynchronously.
 * Safe helper that never throws or breaks the main request execution flow.
 */
export const logAuditAction = async (params: CreateAuditLogParams): Promise<IAuditLog | null> => {
  try {
    const docPayload: Record<string, any> = {
      action: params.action,
    };
    if (params.actorId) docPayload["actorId"] = params.actorId;
    if (params.actorName) docPayload["actorName"] = params.actorName;
    if (params.actorRole) docPayload["actorRole"] = params.actorRole;
    if (params.targetId) docPayload["targetId"] = params.targetId;
    if (params.beforeState) docPayload["beforeState"] = params.beforeState;
    if (params.afterState) docPayload["afterState"] = params.afterState;
    if (params.ipAddress) docPayload["ipAddress"] = params.ipAddress;

    const log = await AuditLog.create(docPayload);
    return log;
  } catch (error) {
    console.error("[AuditLog Error]: Failed to create audit log entry", error);
    return null;
  }
};

/**
 * Get paginated list of audit logs with optional filtering.
 */
export const getAuditLogs = async (query: {
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: IAuditLog[]; total: number }> => {
  const filter: Record<string, any> = {};

  if (query.action) {
    filter["action"] = new RegExp(query.action, "i");
  }

  if (query.actorId) {
    filter["actorId"] = query.actorId;
  }

  if (query.startDate || query.endDate) {
    filter["createdAt"] = {};
    if (query.startDate) {
      filter["createdAt"]["$gte"] = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter["createdAt"]["$lte"] = end;
    }
  }

  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "name phone role email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total };
};
