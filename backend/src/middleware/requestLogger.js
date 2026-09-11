import morgan from "morgan";
import env from "../config/env.js";

// Attach authenticated userId to logs
morgan.token("userId", (req) => req.user?.userId || "anonymous");
morgan.token("body-size", (req) => req.headers["content-length"] || 0);

// Dev format: human-readable colored output
const devFormat = ":method :url :status :response-time[0]ms userId=:userId";

// Prod format: structured JSON for log aggregation
const prodFormat = JSON.stringify({
  method: ":method",
  url: ":url",
  status: ":status",
  responseTime: ":response-time[0]ms",
  userId: ":userId",
  contentLength: ":body-size",
  userAgent: ":user-agent",
  ip: ":remote-addr",
  timestamp: ":date[iso]",
});

export const requestLogger = morgan(
  env.nodeEnv === "production" ? prodFormat : devFormat,
  {
    // Skip health checks to reduce noise
    skip: (req) => req.url === "/health",
  },
);
