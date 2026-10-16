import express from "express";
import http from "http";
import { globalErrorHandler } from "./helpers/globalErrorHandler";
import { serverRunningTemplate } from "./tempaletes/serverlive.template";
import config from "./config";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound";
import { rateLimiter } from "./middleware/rateLimiter.middleware";

const app = express();
const server = http.createServer(app);

// Render/Vercel sit behind one proxy hop: needed for correct client IPs (rate limiting) and secure cookies.
app.set("trust proxy", 1);

/* ── Security Headers ── */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

/* ── Logging ── */
if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("short"));
}

/* ── Strict CORS (exact allow-list from FRONTEND_URL / CORS_ORIGINS) ── */
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: server-to-server (SSLCommerz IPN), curl, health pings
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "");
      const isAllowed = config.corsOrigins.includes(cleanOrigin);
      return callback(null, isAllowed);
    },
    credentials: true,
  }),
);

/* ── Body Parsers ── */
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

/* ── Global API rate limit (per IP) ── */
app.use("/api/v1", rateLimiter(15, 600));

/* ── Health Check ── */
app.get("/health", (_req, res) => {
  const mongoose = require("mongoose");
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    service: "Evergain Avenue API",
    environment: config.env,
    database: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ── Routes ── */
import routes from "./routes/index.api";
app.use("/api/v1", routes);

/* ── Root ── */
app.get("/", serverRunningTemplate);

/* ── 404 Handler ── */
app.use(notFound);

/* ── Global Error Handler ── */
app.use(globalErrorHandler);

export { server };
export default app;
