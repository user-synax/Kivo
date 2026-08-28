import { ApiError, ErrorCodes } from "../utils/errors.js";
import { getRedis } from "../config/redis.js";

// Redis-backed fixed-window rate limiter.
//   key = ratelimit:<prefix>:<clientKey>
// Uses INCR + EXPIRE for an atomic-ish sliding fixed window. Intended for
// brute-force protection on /login and refresh-token abuse on /refresh-token.
//
// options:
//   windowSeconds: size of the window in seconds
//   max: max requests per window
//   keyPrefix: logical bucket name (e.g. "login", "refresh")
//   keyFrom(req): optional custom key extractor (defaults to req.ip)
export function rateLimiter({
  windowSeconds,
  max,
  keyPrefix,
  keyFrom = (req) => req.ip || "unknown",
}) {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      const key = `ratelimit:${keyPrefix}:${keyFrom(req)}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, max - count);
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(remaining));
      if (count > max) {
        const ttl = await redis.ttl(key);
        res.set("Retry-After", String(Math.max(ttl, 1)));
        throw new ApiError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, "Too many requests, please try again later");
      }
      next();
    } catch (err) {
      if (err instanceof ApiError) return next(err);
      // If Redis is unavailable, fail open (log only) to avoid locking out users.
      console.error("[rateLimiter] redis error, allowing request:", err.message);
      next();
    }
  };
}
