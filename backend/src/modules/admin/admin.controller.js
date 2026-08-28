import { asyncHandler } from "../../utils/asyncHandler.js";
import { notFound } from "../../utils/errors.js";
import * as authService from "../auth/auth.service.js";

// Admin-only: force-logout every session belonging to a target user.
// Reuses the same underlying primitive as the user's own /logout-all.
export const forceLogoutUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const result = await authService.forceLogoutUser({ userId });
  res.status(200).json({ success: true, data: result });
});

// Placeholder admin handler (extend as needed) to demonstrate module shape.
export const listUsers = asyncHandler(async (req, res) => {
  // Intentionally minimal; real implementation would paginate users.
  res.status(200).json({ success: true, data: { note: "admin user listing stub" } });
});
