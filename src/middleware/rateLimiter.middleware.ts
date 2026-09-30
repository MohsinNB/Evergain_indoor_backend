import rateLimit from "express-rate-limit";

export const rateLimiter = (
    windowMinutes: number,
    maxRequests: number
) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                message: `Too many requests. Please try again after ${windowMinutes} minutes.`,
            });
        },
    });
};
