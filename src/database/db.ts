import mongoose from "mongoose";
import chalk from "chalk";
import config from "../config";
import { seedSuperAdminsFromConfig } from "../modules/admin/admin.service";

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    console.log(chalk.gray("Using existing database connection"));
    return;
  }

  try {
    const mongoUrl = config.mongoUri;

    if (!mongoUrl) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    const dbInfo = await mongoose.connect(mongoUrl);

    console.log(
      chalk.yellow(`Database connected: ${dbInfo.connection.host}`),
    );

    // Auto-seed initial super admins and default ground if database is empty
    await seedSuperAdminsFromConfig();
    const { getAllGrounds } = require("../modules/ground/ground.service");
    await getAllGrounds(false);

  } catch (error) {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1);
  }
};
