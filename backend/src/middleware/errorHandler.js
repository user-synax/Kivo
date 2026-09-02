import { ErrorCodes } from "../utils/errors.js";
import env from "../config/env.js";

// Express 5 error-handling middleware (4 args required).
// Always responds with { success: false, error: { code, message } }.
// Never leaks stack traces or internal error detail in production.
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  let code = err.code || ErrorCodes.INTERNAL_ERROR;

  // In production, do not reveal internal/operational message details for 5xx.
  let message = err.message || "Internal server error";
  if (statusCode >= 500 && env.isProduction) {
    message = "Internal server error";
    code = ErrorCodes.INTERNAL_ERROR;
  }

  if (statusCode >= 500) {
    // Log server errors for observability; never the stack to the client.
    console.error("[error]", err.code || "INTERNAL_ERROR", "-", err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      // Only populated when an error explicitly carries extra context (e.g.
      // EMAIL_NOT_VERIFIED passes the userId so the client can route to OTP
      // verification). Undefined for every other error.
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  });
}

// 404 fallback for unmatched routes.
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: { code: ErrorCodes.NOT_FOUND, message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}
