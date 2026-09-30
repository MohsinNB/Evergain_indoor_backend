import mongoose from "mongoose";
import chalk from "chalk";
import config from "../config";

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

    // TODO: Register cron jobs here as modules are built
    // e.g. startWeeklyBookingGeneratorCron() — permanent booking job (last module)

  } catch (error) {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1);
  }
};
