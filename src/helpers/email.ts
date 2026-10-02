import nodemailer from "nodemailer";
import chalk from "chalk";
import config from "../config";

/**
 * Sends HTML Email using Nodemailer.
 * Configured via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 * In development, logs formatted Email to console if SMTP credentials are absent.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<boolean> => {
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM ?? '"Evergain Avenue" <noreply@evergainavenue.com>';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(
        chalk.bgMagenta.white(" [DEVELOPMENT EMAIL DISPATCH] ") +
          chalk.cyan(`\n✉️  To: ${to}`) +
          chalk.magenta(`\n📌 Subject: ${subject}`) +
          chalk.white(`\n📄 HTML Content:\n${html.replace(/<[^>]*>/g, "").trim()}\n`),
      );
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
    });

    return !!info.messageId;
  } catch (error) {
    console.error(chalk.red("Email delivery failed:"), error);
    return false;
  }
};
