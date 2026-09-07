import { asyncHandler } from "../../utils/asyncHandler.js";
import env from "../../config/env.js";
import * as adminService from "./admin.service.js";

function getClientIp(req) {
  return req.ip || req.headers["x-forwarded-for"] || null;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Email and password are required" },
    });
  }
  const { token } = await adminService.adminLogin({
    email,
    password,
    ip: getClientIp(req),
  });

  // Set httpOnly cookie — separate from user auth cookies.
  res.cookie(env.adminCookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60 * 1000, // 30 min
  });

  res.status(200).json({ success: true, data: { authenticated: true } });
});

export const logout = asyncHandler(async (req, res) => {
  adminService.adminLogout();
  res.clearCookie(env.adminCookieName, { path: "/" });
  res.status(200).json({ success: true, data: { loggedOut: true } });
});

// Lightweight verify endpoint — if requireAdmin passes, the cookie is valid.
// The frontend gate calls this on mount to check auth status.
export const verify = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { authenticated: true } });
});

// ── Stats ───────────────────────────────────────────────────────────────────

export const getStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getStats();
  res.status(200).json({ success: true, data: stats });
});

// ── Users ───────────────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, q, banned } = req.query;
  const data = await adminService.listUsers({ page, limit, q, banned });
  res.status(200).json({ success: true, data });
});

export const getUserDetail = asyncHandler(async (req, res) => {
  const data = await adminService.getUserDetail(req.params.id);
  res.status(200).json({ success: true, data });
});

export const banUser = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const data = await adminService.banUser({
    userId: req.params.id,
    reason,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const unbanUser = asyncHandler(async (req, res) => {
  const data = await adminService.unbanUser({
    userId: req.params.id,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const setUserPlan = asyncHandler(async (req, res) => {
  const { plan, expiresAt } = req.body || {};
  const data = await adminService.setUserPlan({
    userId: req.params.id,
    plan,
    expiresAt: expiresAt || null,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

// ── Plus Claims (manual-UPI review queue) ───────────────────────────────────

export const listPlusRequests = asyncHandler(async (req, res) => {
  const data = await adminService.listPlusRequests({
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data });
});

export const approvePlusRequest = asyncHandler(async (req, res) => {
  const data = await adminService.approvePlusRequest({
    claimId: req.params.claimId,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const rejectPlusRequest = asyncHandler(async (req, res) => {
  const { note } = req.body || {};
  const data = await adminService.rejectPlusRequest({
    claimId: req.params.claimId,
    note,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

// ── Groups ──────────────────────────────────────────────────────────────────

export const listGroups = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await adminService.listGroups({ page, limit });
  res.status(200).json({ success: true, data });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const data = await adminService.deleteGroup({
    groupId: req.params.id,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});

// ── Spaces ──────────────────────────────────────────────────────────────────

export const listSpaces = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await adminService.listSpaces({ page, limit });
  res.status(200).json({ success: true, data });
});

export const deleteSpace = asyncHandler(async (req, res) => {
  const data = await adminService.deleteSpace({
    spaceId: req.params.id,
    ip: getClientIp(req),
  });
  res.status(200).json({ success: true, data });
});
