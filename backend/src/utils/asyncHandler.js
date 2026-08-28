// Wraps an async Express handler so thrown/rejected errors are forwarded to
// the error-handling middleware. With Express 5 this is largely handled
// natively, but wrapping keeps intent explicit and is safe for Express 4 too.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
