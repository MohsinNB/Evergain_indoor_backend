import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();
import { connectDatabase } from "./database/db";
import config from "./config/index";
import { server } from "./app";

import { initWeeklyCronSchedule } from "./modules/permanentBooking/weeklyGenerator.job";
import { startKeepAlive } from "./utils/keepAlive";

const PORT = config.port ? Number(config.port) : 8000;

/** Fail fast (with a clear message) instead of crashing later on the first request. */
const assertRequiredEnv = (): void => {
  const missing: string[] = [];
  if (!config.mongoUri) missing.push("MONGO_URI");
  if (!config.jwt.adminSecret) missing.push("ADMIN_JWT_SECRET");
  if (!config.jwt.customerSecret) missing.push("CUSTOMER_JWT_SECRET");

  if (missing.length > 0) {
    console.error(chalk.red(`Missing required environment variables: ${missing.join(", ")}`));
    process.exit(1);
  }

  if (config.jwt.adminSecret === config.jwt.customerSecret) {
    console.warn(
      chalk.yellow("[Security] ADMIN_JWT_SECRET and CUSTOMER_JWT_SECRET should be different values."),
    );
  }
  if (config.jwt.adminSecret.length < 32 || config.jwt.customerSecret.length < 32) {
    console.warn(
      chalk.yellow("[Security] JWT secrets shorter than 32 characters are weak. Use `openssl rand -hex 48`."),
    );
  }
  if (config.env === "production" && (!config.sslcommerz.storeId || config.sslcommerz.storeId === "your_store_id")) {
    console.warn(
      chalk.yellow("[Payments] SSLCOMMERZ_STORE_ID is not configured — online payments will be refused in production."),
    );
  }
};

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("Unhandled promise rejection:"), reason);
});

assertRequiredEnv();

connectDatabase()
  .then(() => {
    // Initialize background cron schedule for permanent bookings
    initWeeklyCronSchedule();

    server.listen(PORT, () => {
      console.log(chalk.green(`Server running at http://localhost:${PORT}`));
      startKeepAlive();
    });
  })
  .catch((error: unknown) => {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1);
  });
