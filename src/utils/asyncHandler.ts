import type { Request, Response, NextFunction } from "express";
import fs from "fs";

type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncController) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {

      //if error then revove the image from local folder
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }

      next(error);
    }
  };
};
