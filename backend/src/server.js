import http from "node:http";
import app from "./app.js";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { initSocket } from "./socket/index.js";
import { sweepPlus } from "./modules/plus/plus.service.js";
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
        console.log(
          `[plus] sweep: expired ${r.expiredClaims} claim(s), scrubbed ${r.scrubbedEffects} effect(s)`,
        );
      }
    } catch (err) {
      console.error("[plus] sweep failed:", err?.message || err);
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

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
