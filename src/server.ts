import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();
import { connectDatabase } from "./database/db";
import config from "./config/index";
import { server } from "./app";

const PORT = config.port ? Number(config.port) : 8000;

connectDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(chalk.green(`Server running at http://localhost:${PORT}`));
    });
  })
  .catch((error: unknown) => {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1);
  });
