import chalk from "chalk";
import config from "../config";
import axios from "axios";

/**
 * Sends SMS to a Bangladeshi phone number.
 * In development, prints formatted SMS to console for free instant testing.
 * In production, dispatches HTTP POST/GET to SMS Gateway provider.
 */
export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  try {
    if (config.env === "development" || !process.env.BD_SMS_API_KEY) {
      console.log(
        chalk.bgYellow.black(" [DEVELOPMENT SMS DISPATCH] ") +
          chalk.cyan(`\n📱 To: ${phone}`) +
          chalk.yellow(`\n💬 Message: ${message}\n`),
      );
      return true;
    }

    // Production SMS Gateway Integration Point (e.g. Greenweb / BulkSMSBD)
    const smsApiKey = process.env.BD_SMS_API_KEY;
    const smsSenderId = process.env.BD_SMS_SENDER_ID ?? "EVERGAIN";

    const response = await axios.post("https://api.greenweb.com.bd/api.php", {
      token: smsApiKey,
      to: phone,
      message,
    });

    return response.status === 200;
  } catch (error) {
    console.error(chalk.red("SMS delivery failed:"), error);
    // Non-blocking in dev
    return false;
  }
};
