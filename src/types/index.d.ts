import { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        _id: string | Types.ObjectId;
        phone: string;
        role: "super_admin" | "admin" | "staff";
      };
      customer?: {
        _id: string | Types.ObjectId;
        phone: string;
      };
    }
  }
}

export {};
