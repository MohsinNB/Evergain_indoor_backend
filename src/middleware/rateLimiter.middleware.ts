import rateLimit from "express-rate-limit";

/**
 * Per-IP rate limiter.
 * @param windowMinutes length of the window in MINUTES
 * @param maxRequests   max requests allowed per IP within that window
 */
export const rateLimiter = (windowMinutes: number, maxRequests: number) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: `Too many requests. Please try again after ${windowMinutes} minutes.`,
      });
    },
  });
};
