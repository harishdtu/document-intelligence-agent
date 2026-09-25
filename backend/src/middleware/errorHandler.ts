import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Uploaded file exceeds the maximum allowed size." : err.message;
    logger.warn("Multer upload error", { code: err.code, message });
    return res.status(400).json({ error: "upload_error", message });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { statusCode: err.statusCode, details: err.details });
    } else {
      logger.warn(err.message, { statusCode: err.statusCode, details: err.details });
    }
    return res.status(err.statusCode).json({ error: err.name, message: err.message, details: err.details });
  }

  const message = err instanceof Error ? err.message : "Unexpected server error";
  logger.error("Unhandled error", { message, stack: err instanceof Error ? err.stack : undefined });
  return res.status(500).json({ error: "internal_error", message: "An unexpected error occurred." });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
