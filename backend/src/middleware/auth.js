import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { unauthorized } from "../utils/errors.js";
import User from "../models/User.js";

// Verifies the short-lived access token. Attaches:
//   req.user = { userId, sessionId }
// This is intentionally STATELESS — no Redis lookup here. Force-logout takes
// effect at most within the access token TTL (15m) by design.
export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw unauthorized("Missing or malformed Authorization header");
    }

    let payload;
    try {
      payload = jwt.verify(token, env.accessTokenSecret);
    } catch (verifyErr) {
      if (verifyErr.name === "TokenExpiredError") {
        throw unauthorized("Access token expired");
      }
      throw unauthorized("Invalid access token");
    }

    if (!payload.userId || !payload.sessionId) {
      throw unauthorized("Invalid access token payload");
    }

    req.user = { userId: payload.userId, sessionId: payload.sessionId };
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based authorization. The access token does not carry the role (see spec),
// so we resolve it from the DB using the verified userId. Reused by admin routes.
export function authorize(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        throw unauthorized("Authentication required");
      }
      const user = await User.findById(req.user.userId).select("role");
      if (!user) {
        throw unauthorized("User no longer exists");
      }
      req.user.role = user.role;
      if (allowed.length > 0 && !allowed.includes(user.role)) {
        throw unauthorized("Insufficient permissions");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
