import axios from "axios";
import chalk from "chalk";
import config from "../config";

/**
 * Render's free tier puts a web service to sleep after ~15 minutes without inbound traffic.
 * Pinging our own PUBLIC url counts as inbound traffic and keeps the instance awake
 * (important here: the permanent-booking cron job and payment callbacks need a live server).
 *
 * Note: this cannot wake a service that is already asleep — pair it with an external
 * pinger (e.g. UptimeRobot) as a backup.
 */
export const startKeepAlive = (): void => {
  if (config.env !== "production" || !config.keepAlive.enabled) return;

  if (!config.backendUrl) {
    console.warn(
      chalk.yellow(
        "[KeepAlive] Skipped: BACKEND_URL / RENDER_EXTERNAL_URL is not set, so the service may sleep on idle.",
      ),
    );
    return;
  }

  const target = `${config.backendUrl}/health`;
  const intervalMs = Math.max(1, config.keepAlive.intervalMinutes) * 60 * 1000;

  const ping = async (): Promise<void> => {
    try {
      await axios.get(target, { timeout: 15_000 });
    } catch (error: any) {
      console.warn(chalk.yellow(`[KeepAlive] Ping failed: ${error?.message ?? error}`));
    }
  };

  const timer = setInterval(ping, intervalMs);
  timer.unref(); // never block process shutdown
  console.log(chalk.gray(`[KeepAlive] Pinging ${target} every ${config.keepAlive.intervalMinutes} min.`));
};
