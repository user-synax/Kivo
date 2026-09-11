import logger from "../lib/logger.js";
import { sendEmail } from "../lib/email.js";
import env from "../config/env.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Session from "../models/Session.js";

async function gatherStats() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    newUsers,
    totalUsers,
    messagesSent,
    activeConversations,
    activeSessions,
    newConversations,
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    User.countDocuments(),
    Message.countDocuments({
      createdAt: { $gte: startOfDay },
      isDeleted: false,
    }),
    Message.distinct("conversationId", {
      createdAt: { $gte: startOfDay },
    }).then((r) => r.length),
    Session.countDocuments({ expiresAt: { $gt: now } }),
    Conversation.countDocuments({ createdAt: { $gte: startOfDay } }),
  ]);

  return {
    date: now.toISOString().split("T")[0],
    newUsers,
    totalUsers,
    messagesSent,
    activeConversations,
    activeSessions,
    newConversations,
  };
}

function buildHtmlReport(stats) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 20px; }
        h2 { color: #4ba9e1; border-bottom: 2px solid #4ba9e1; padding-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; max-width: 500px; margin-top: 16px; }
        td { padding: 10px 16px; border: 1px solid #e0e0e0; }
        td:first-child { background: #f7f9fc; font-weight: 600; width: 220px; }
        td:last-child { font-variant-numeric: tabular-nums; text-align: right; }
        .footer { margin-top: 24px; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <h2>Kivo Daily Report &mdash; ${stats.date}</h2>
      <table>
        <tr><td>Total Users</td><td>${stats.totalUsers}</td></tr>
        <tr><td>New Users Today</td><td>${stats.newUsers}</td></tr>
        <tr><td>Messages Sent</td><td>${stats.messagesSent}</td></tr>
        <tr><td>Active Conversations (today)</td><td>${stats.activeConversations}</td></tr>
        <tr><td>Active Sessions</td><td>${stats.activeSessions}</td></tr>
        <tr><td>New Conversations</td><td>${stats.newConversations}</td></tr>
      </table>
      <p class="footer">Generated automatically by Kivo Backend</p>
    </body>
    </html>
  `;
}

export async function sendDailyReport() {
  if (!env.adminEmail) {
    logger.warn("[daily-report] ADMIN_EMAIL not set, skipping report");
    return;
  }
  try {
    const stats = await gatherStats();
    await sendEmail({
      to: env.adminEmail,
      subject: `Kivo Daily Report — ${stats.date}`,
      html: buildHtmlReport(stats),
    });
    logger.info({ date: stats.date, to: env.adminEmail }, "[daily-report] sent successfully");
  } catch (err) {
    logger.error({ err: err?.message || err }, "[daily-report] failed to send");
  }
}

/**
 * Start the daily report job. Runs once at boot, then every 24 hours.
 * Uses an unref'd timer so it never keeps the process alive.
 */
export function startDailyReportJob() {
  // Send first report a short delay after boot (let DB settle)
  setTimeout(() => {
    sendDailyReport().catch((err) =>
      logger.error({ err: err?.message }, "[daily-report] boot report failed"),
    );
  }, 30_000);

  // Then once every 24 hours
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    sendDailyReport().catch((err) =>
      logger.error({ err: err?.message }, "[daily-report] scheduled report failed"),
    );
  }, MS_PER_DAY);
  if (typeof timer.unref === "function") timer.unref();
}
