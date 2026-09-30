import path from "path";
import dotenv from "dotenv";

(dotenv as any).config({ path: path.join(process.cwd(), ".env") });

const config = {
  /* ================= Server ================= */
  env: process.env.NODE_ENV === "development" ? "development" : "production",
  port: Number(process.env.PORT) || 5000,

  /* ================= Database ================= */
  mongoUri: process.env.MONGO_URI as string,

  /* ================= Security ================= */
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  /* ================= JWT ================= */
  jwt: {
    adminSecret: process.env.ADMIN_JWT_SECRET as string,
    adminExpire: process.env.ADMIN_JWT_EXPIRE ?? "1d",

    customerSecret: process.env.CUSTOMER_JWT_SECRET as string,
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

  /* ================= Frontend ================= */
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  /* ================= Rate Limit ================= */
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
};

export default config;
