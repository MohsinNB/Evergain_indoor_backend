import multer, { StorageEngine, MulterError, FileFilterCallback } from "multer";
import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import CustomError from "../helpers/CustomError";

const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "public", "temp");

    // create folder if not exists
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${name}_${timestamp}${ext}`);
  },
});

// Only allow image types (for gallery uploads)
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new CustomError(400, "Invalid file type. Only JPEG, PNG, JPG, WEBP are allowed."),
    );
  }
  cb(null, true);
};

// Multer instance for images (max 5MB)
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// Middleware wrapper to catch Multer errors and pass them through globalErrorHandler
export const uploadSingle =
  (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          return next(
            new CustomError(400, "File too large. Maximum allowed size is 5MB."),
          );
        }
        if (err instanceof CustomError) {
          return next(err);
        }
        return next(new CustomError(400, err.message));
      }
      next();
    });
  };
