import http from "node:http";
import app from "./app.js";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { initSocket } from "./socket/index.js";

async function start() {
  await connectDb();

  // Create the HTTP server from the Express app so Socket.IO can share the same
  // port and transport upgrades.
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
