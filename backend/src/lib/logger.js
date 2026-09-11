import pino from "pino";
import env from "../config/env.js";

const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  // Pretty-print in dev, raw JSON in production
  transport:
    env.nodeEnv !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  base: { service: "kivo-backend" },
});

export default logger;
