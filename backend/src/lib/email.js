import nodemailer from "nodemailer";
import env from "../config/env.js";

// Lazy-initialized transporter — created on first send so the app boots even if
// Gmail credentials are not yet configured (dev convenience).
let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!env.gmailUser || !env.gmailAppPassword) {
      throw new Error(
        "Gmail SMTP is not configured — set GMAIL_USER and GMAIL_APP_PASSWORD in your .env",
      );
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.gmailUser,
        pass: env.gmailAppPassword,
      },
    });
  }
  return transporter;
}

/**
 * Send an email through the configured Gmail SMTP transport.
 *
 * @param {Object} options
 * @param {string} options.to      - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html    - HTML body
 * @returns {Promise<nodemailer.SentMessageInfo>}
 */
export async function sendEmail({ to, subject, html }) {
  const from = env.emailFrom || env.gmailUser;
  const transport = getTransporter();

  const info = await transport.sendMail({
    from,
    to,
    subject,
    html,
  });

  return info;
}
