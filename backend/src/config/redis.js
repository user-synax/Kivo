import { createClient } from "redis";
import env from "./env.js";

const redisClient = createClient({ url: env.redisUrl });

redisClient.on("error", (err) => {
  // Do not crash the process on transient Redis errors; log and continue.
  console.error("[redis] client error:", err.message);
});

let connected = false;

export async function connectRedis() {
  if (!connected) {
    await redisClient.connect();
    connected = true;
  }
  return redisClient;
}

export function getRedis() {
  if (!connected) {
    throw new Error("Redis client not connected. Call connectRedis() during boot.");
  }
  return redisClient;
}

export default redisClient;
