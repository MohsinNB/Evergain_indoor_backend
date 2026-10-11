import path from "path";
import dotenv from "dotenv";

(dotenv as any).config({ path: path.join(process.cwd(), ".env") });

const stripSlash = (value: string): string => value.trim().replace(/\/+$/, "");

const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((v) => stripSlash(v))
    .filter(Boolean);

const isDevelopment = process.env.NODE_ENV === "development";

const frontendUrl = stripSlash(process.env.FRONTEND_URL ?? "http://localhost:3000");

/**
 * Public URL of THIS backend (used for SSLCommerz callback URLs and the keep-alive ping).
 * On Render, RENDER_EXTERNAL_URL is injected automatically.
 */
const backendUrl = stripSlash(
  process.env.BACKEND_URL ?? process.env.RENDER_EXTERNAL_URL ?? "",
);

const config = {
  /* ================= Server ================= */
  env: isDevelopment ? "development" : "production",
  port: Number(process.env.PORT) || 5000,
  backendUrl,

  /* ================= Database ================= */
  mongoUri: process.env.MONGO_URI as string,

  /* ================= Security ================= */
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  /* ================= JWT ================= */
  jwt: {
    adminSecret: process.env.ADMIN_JWT_SECRET as string,
    adminExpire: process.env.ADMIN_JWT_EXPIRE ?? "1d",

    customerSecret:
      (process.env.CUSTOMER_JWT_SECRET || process.env.ADMIN_JWT_SECRET) as string,
    customerExpire: process.env.CUSTOMER_JWT_EXPIRE ?? "7d",
  },

  /* ================= SSLCommerz ================= */
  sslcommerz: {
    storeId: process.env.SSLCOMMERZ_STORE_ID as string,
    storePass: process.env.SSLCOMMERZ_STORE_PASS as string,
    // true = live, false = sandbox
    isLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
  },

  /* ================= Cloudinary ================= */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    apiSecret: process.env.CLOUDINARY_API_SECRET as string,
  },

  /* ================= Frontend / CORS ================= */
  frontendUrl,
  // Exact-match allow list. FRONTEND_URL and CORS_ORIGINS may hold comma separated URLs.
  corsOrigins: Array.from(
    new Set([
      ...splitList(process.env.FRONTEND_URL),
      ...splitList(process.env.CORS_ORIGINS),
      ...(isDevelopment ? ["http://localhost:3000", "http://localhost:5173"] : []),
    ]),
  ),

  /* ================= Rate Limit ================= */
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },

  /* ================= Keep-alive (Render free tier) ================= */
  keepAlive: {
    enabled: process.env.KEEP_ALIVE !== "false",
    intervalMinutes: Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10,
  },

  /* ================= Super Admin Auto-Seeding ================= */
  superAdmin: {
    emails: (process.env.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    // No hardcoded fallback: in production a missing/weak value disables seeding.
    defaultPassword: process.env.SUPER_ADMIN_DEFAULT_PASSWORD ?? "",
  },
};

export default config;
