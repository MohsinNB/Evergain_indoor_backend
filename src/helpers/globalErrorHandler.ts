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
  const isKnownError = error instanceof CustomError;
  let err: CustomError = isKnownError
    ? (error as CustomError)
    : new CustomError(500, error.message);

  if (error instanceof jwt.TokenExpiredError) {
    err = new CustomError(401, "JWT token expired.");
  } else if (error instanceof jwt.JsonWebTokenError) {
    err = new CustomError(401, "Invalid access token.");
  } else if (error.name === "ValidationError") {
    const validationErrors = Object.values((error as mongoose.Error.ValidationError).errors).map((el: any) => ({
      field: el.path,
      message: el.message,
      kind: el.kind,
    }));
    err = new CustomError(400, "Validation failed", validationErrors);
  } else if ((error as any).code === 11000) {
    const key = Object.keys((error as any).keyValue ?? {})[0];
    err = new CustomError(
      400,
      key ? `A record with this ${key} already exists.` : "Duplicate value.",
      { field: key },
    );
  } else if (error.name === "CastError") {
    const castError = error as mongoose.Error.CastError;
    err = new CustomError(400, `Invalid ${castError.path}.`, { field: castError.path });
  } else if (!isKnownError) {
    // body-parser / http-errors style errors (malformed JSON, payload too large, ...)
    const httpStatus = (error as any).status ?? (error as any).statusCode;
    if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) {
      err = new CustomError(
        httpStatus,
        httpStatus === 413 ? "Request body is too large." : "Malformed request.",
      );
    }
  }

  if (err.statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, error);
  }

  if (process.env.NODE_ENV === "development") {
    return developmentError(err, res);
  }

  // Never expose internal error text for unexpected (non-CustomError) server failures.
  if (err.statusCode >= 500 && !isKnownError) {
    err = new CustomError(500, "Something went wrong on our side. Please try again.");
  }
  return productionError(err, res);
};
