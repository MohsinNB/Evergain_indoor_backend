import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import CustomError from "./CustomError";

const developmentError = (error: CustomError, res: Response): Response => {
  const stackLines = error.stack ? error.stack.split("\n") : [];
  return res.status(error.statusCode).json({
    message: error.message,
    success: false,
    status: error.status,
    statusCode: error.statusCode,
    isOperationalError: error.isOperationalError,
    data: error.data,
    stack: stackLines,
  });
};


const productionError = (error: CustomError, res: Response): Response => {
  return res.status(error.statusCode).json({
    message: error.message,
    success: false,
    status: error.status,
    statusCode: error.statusCode,
  });
};

export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  let err: CustomError = error instanceof CustomError
    ? error
    : new CustomError(500, error.message);

  if (error instanceof jwt.TokenExpiredError) {
    err = new CustomError(401, "JWT token expired.");
  } else if (error instanceof jwt.JsonWebTokenError) {
    err = new CustomError(401, "Invalid access token.");
  } else 
    if (error.name === "ValidationError") {
    const validationErrors = Object.values((error as mongoose.Error.ValidationError).errors).map((el: any) => ({
      field: el.path,
      message: el.message,
      kind: el.kind,
    }));
    err = new CustomError(400, "Validation failed", validationErrors);
  } else if ((error as any).code === 11000) {
    const key = Object.keys((error as any).keyValue)[0];
    const value = (error as any).keyValue[key as string];
    err = new CustomError(400, `Duplicate field value: ${value}`, { field: key, value });
  } else if (error.name === "CastError") {
    const castError = error as mongoose.Error.CastError;
    err = new CustomError(400, `Invalid ${castError.path}: ${castError.value}`, { field: castError.path, value: castError.value });
  }

  if (process.env.NODE_ENV === "development") {
    return developmentError(err, res);
  }
  return productionError(err, res);
};
