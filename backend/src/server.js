import http from "node:http";
import app from "./app.js";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { initSocket } from "./socket/index.js";
import { sweepPlus } from "./modules/plus/plus.service.js";
import { cleanupExpiredStatuses } from "./modules/status/status.service.js";
import { closeExpiredPolls } from "./modules/messages/messages.service.js";
import { startScheduledJob } from "./jobs/scheduledMessages.js";
import logger from "./lib/logger.js";
import "./config/webpush.js";

// Hourly sweep (plus a run at boot): lapse Plus claims past their 24h review
// window, and scrub Plus-only profile effects on lapsed grants. Uses the same
// unref'd-timer pattern as the rate-limiter sweep so it never keeps the
// process alive on its own.
function startPlusSweep() {
  const run = async () => {
    try {
      const r = await sweepPlus();
      if (r.expiredClaims > 0 || r.scrubbedEffects > 0) {
        logger.info({ expiredClaims: r.expiredClaims, scrubbedEffects: r.scrubbedEffects }, "[plus] sweep");
      }
    } catch (err) {
      logger.error({ err: err?.message || err }, "[plus] sweep failed");
    }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

function startStatusSweep() {
  const run = async () => {
    try {
      await cleanupExpiredStatuses();
    } catch (err) {
      logger.error({ err: err?.message || err }, "[status] sweep failed");
    }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

function startPollSweep() {
  const run = async () => {
    try {
      const n = await closeExpiredPolls();
      if (n > 0) logger.info({ closed: n }, "[poll] closed expired polls");
    } catch (err) {
      logger.error({ err: err?.message || err }, "[poll] sweep failed");
    }
  };
  const timer = setInterval(run, 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

function startStatusExpirySweep() {
  const run = async () => {
    try {
      const { clearExpiredStatuses } = await import("./modules/users/users.service.js");
      const n = await clearExpiredStatuses();
      if (n > 0) logger.info({ cleared: n }, "[status-expiry] cleared expired statuses");
    } catch (err) {
      logger.error({ err: err?.message || err }, "[status-expiry] sweep failed");
    }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

async function start() {
  await connectDb();

  // Create the HTTP server from the Express app so Socket.IO can share the same
  // port and transport upgrades.
  const server = http.createServer(app);
  initSocket(server);

  startPlusSweep();
  startStatusSweep();
  startPollSweep();
  startStatusExpirySweep();
  startScheduledJob();

  server.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, "[server] listening");
  });
}

start().catch((err) => {
  logger.error({ err: err?.message || err }, "[server] failed to start");
  process.exit(1);
});
