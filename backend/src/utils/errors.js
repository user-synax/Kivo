// Centralized error class. All thrown errors in the app should use this shape so
// the error-handling middleware can produce a consistent response body.
//
// Response shape (see middleware/errorHandler.js):
//   { success: false, error: { code, message } }
// `details` is optional and only surfaced for specific flows (e.g. login with an
// unverified email passes the userId so the client can route to OTP verify).
// Every other error keeps the plain { code, message } envelope.
export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export const ErrorCodes = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export function badRequest(message, code = ErrorCodes.BAD_REQUEST) {
  return new ApiError(400, code, message);
}
export function unauthorized(message = "Unauthorized", code = ErrorCodes.UNAUTHORIZED) {
  return new ApiError(401, code, message);
}
export function forbidden(message = "Forbidden", code = ErrorCodes.FORBIDDEN) {
  return new ApiError(403, code, message);
}
export function notFound(message = "Not found", code = ErrorCodes.NOT_FOUND) {
  return new ApiError(404, code, message);
}
export function conflict(message, code = ErrorCodes.CONFLICT) {
  return new ApiError(409, code, message);
}
export function internal(message = "Internal server error", code = ErrorCodes.INTERNAL_ERROR) {
  return new ApiError(500, code, message);
}
