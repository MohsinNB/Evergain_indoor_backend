import { Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorName?: string;
  actorRole?: string;
  action: string;
  targetId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

export type CreateAuditLogParams = {
  actorId?: string | Types.ObjectId | undefined;
  actorName?: string | undefined;
  actorRole?: string | undefined;
  action: string;
  targetId?: string | undefined;
  beforeState?: Record<string, any> | undefined;
  afterState?: Record<string, any> | undefined;
  ipAddress?: string | undefined;
};
