import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { unauthorized } from "../utils/errors.js";

/**
 * Verify the admin_token httpOnly cookie. This middleware is completely
 * independent of the regular user authenticate middleware — regular user
 * JWTs must never pass this check.
 *
 * Attaches req.admin = { role: 'admin' } on success.
 */
export function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.[env.adminCookieName];
    if (!token) {
      throw unauthorized("Admin authentication required", "ADMIN_UNAUTHENTICATED");
    }

    let payload;
    try {
      payload = jwt.verify(token, env.adminJwtSecret);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw unauthorized("Admin session expired", "ADMIN_SESSION_EXPIRED");
      }
      throw unauthorized("Invalid admin token", "ADMIN_INVALID_TOKEN");
    }

    if (payload.role !== "admin") {
      throw unauthorized("Invalid admin token", "ADMIN_INVALID_TOKEN");
    }

    req.admin = { role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}
