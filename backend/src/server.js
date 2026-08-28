import app from "./app.js";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { connectRedis } from "./config/redis.js";

async function start() {
  await connectDb();
  await connectRedis();

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
