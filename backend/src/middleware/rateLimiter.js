import { ApiError, ErrorCodes } from "../utils/errors.js";

// In-memory fixed-window rate limiter (no Redis dependency).
// NOTE: state is per-process. For multi-instance deployments, back this with a
// shared store (e.g. MongoDB) using the same window/key shape.
//
// options:
//   windowSeconds: size of the window in seconds
//   max: max requests per window
//   keyPrefix: logical bucket name (e.g. "login", "refresh")
//   keyFrom(req): optional custom key extractor (defaults to req.ip)
const buckets = new Map();

export function rateLimiter({
  windowSeconds,
  max,
  keyPrefix,
  keyFrom = (req) => req.ip || "unknown",
}) {
  return (req, res, next) => {
    const key = `ratelimit:${keyPrefix}:${keyFrom(req)}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const entry = buckets.get(key);
    if (!entry || now - entry.start > windowMs) {
      buckets.set(key, { start: now, count: 1 });
    } else {
      entry.count += 1;
    }

    const current = buckets.get(key);
    const remaining = Math.max(0, max - current.count);
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(remaining));

    if (current.count > max) {
      const retryAfter = Math.ceil((current.start + windowMs - now) / 1000);
      res.set("Retry-After", String(Math.max(retryAfter, 1)));
      return next(
        new ApiError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, "Too many requests, please try again later")
      );
    }
    next();
  };
}
