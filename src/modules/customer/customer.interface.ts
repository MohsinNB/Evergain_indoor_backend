import { Document, Types } from "mongoose";

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  phone: string;
  name: string;
  email?: string;
  passwordHash?: string;
  isRegistered: boolean;
  totalBookings: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type CustomerSignupInput = {
  name: string;
  phone: string;
  password: string;
  email?: string;
};

export type CustomerLoginInput = {
  phone: string;
  password: string;
};
