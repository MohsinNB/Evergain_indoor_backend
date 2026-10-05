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

/* ── Dynamic CORS ── */
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, server-to-server, Postman, SSLCommerz IPN)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, "");
      const cleanFrontendUrl = (config.frontendUrl || "").replace(/\/$/, "");

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        cleanFrontendUrl,
      ];

      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith(".vercel.app") ||
        cleanOrigin.includes("vercel.app")
      ) {
        return callback(null, true);
      }

      // Allow all origins to prevent CORS block on production deployments
      return callback(null, true);
    },
    credentials: true,
  }),
);

/* ── Body Parsers ── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
