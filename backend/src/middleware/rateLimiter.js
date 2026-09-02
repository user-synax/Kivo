import { ApiError, ErrorCodes } from "../utils/errors.js";

// In-memory fixed-window rate limiter (no Redis dependency).
// NOTE: state is per-process. For multi-instance deployments, back this with a
// shared store (e.g. MongoDB) using the same window/key shape.
//
// options:
//   windowSeconds: size of the window in seconds
//   max: max requests per window
//   keyPrefix: logical bucket name (e.g. "login", "refresh")
//   keyFrom(req): optional custom key extractor (defaults to authenticated user if present, else req.ip)
const buckets = new Map();

// Prefer authenticated user id over IP so multiple users behind one NAT don't
// share a bucket and a single abusive user can't bypass by switching networks.
// Falls back to IP for pre-auth routes (login/refresh/etc.).
export function userKey(req) {
  return req.user?.userId || req.user?.id || req.ip || "unknown";
}

export function rateLimiter({
  windowSeconds,
  max,
  keyPrefix,
  keyFrom = userKey,
}) {
  return (req, res, next) => {
    const key = `ratelimit:${keyPrefix}:${keyFrom(req)}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const entry = buckets.get(key);
    if (!entry || now - entry.start > windowMs) {
      buckets.set(key, { start: now, count: 1, windowMs });
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

// Periodic sweep to evict expired buckets so long-running processes don't leak
// memory as more distinct users/IPs are seen over time. Uses per-entry windowMs
// so heterogeneous windows are handled correctly.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
if (!global._kivoRateLimitSweep) {
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      const win = entry.windowMs || 0;
      if (now - entry.start > win) {
        buckets.delete(key);
      }
    }
  }, SWEEP_INTERVAL_MS);
  // Don't keep the process alive solely for the sweep timer.
  if (typeof sweep.unref === "function") sweep.unref();
  global._kivoRateLimitSweep = sweep;
}
