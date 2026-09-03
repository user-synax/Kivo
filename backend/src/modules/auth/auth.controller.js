import env, { refreshTtlSeconds } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  parseBody,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  loginTwoFactorSchema,
} from "./auth.validation.js";
import * as authService from "./auth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction, // only sent over HTTPS in production
    sameSite: env.refreshCookieSameSite, // "strict" (or "lax" for cross-subdomain)
    path: env.refreshCookiePath, // scoped to /api/v1/auth
    maxAge: refreshTtlSeconds() * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.refreshCookieSameSite,
    path: env.refreshCookiePath,
  });
}

function deviceInfoFrom(req) {
  return {
    userAgent: req.headers["user-agent"] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
  };
}

// ── Existing routes ─────────────────────────────────────────────────────────

export const register = asyncHandler(async (req, res) => {
  const data = parseBody(registerSchema, req.body);
  const result = await authService.registerUser({
    ...data,
    deviceInfo: deviceInfoFrom(req),
  });

  // Session is issued immediately — no OTP barrier.
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const login = asyncHandler(async (req, res) => {
  const data = parseBody(loginSchema, req.body);
  const result = await authService.loginUser({
    identifier: data.identifier,
    password: data.password,
    deviceInfo: deviceInfoFrom(req),
  });

  // 2FA gate: the password was correct but the account requires a second
  // factor. No session is issued yet — the client must complete /login/2fa
  // with the returned one-time ticket.
  if (result.twoFactorRequired) {
    res.status(200).json({
      success: true,
      data: { twoFactorRequired: true, ticket: result.ticket },
    });
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const result = await authService.refreshSession({ refreshToken: token });

  // Rotate the cookie too — old refresh token is now invalid.
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    data: { accessToken: result.accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  // sessionId is taken from the VERIFIED access token, never from the body.
  await authService.logoutSession({
    sessionId: req.user.sessionId,
    userId: req.user.userId,
  });
  clearRefreshCookie(res);
  res.status(200).json({ success: true, data: null });
});

export const logoutAll = asyncHandler(async (req, res) => {
  // Always derive the target user from the verified token.
  await authService.logoutAllSessions({ userId: req.user.userId });
  clearRefreshCookie(res);
  res.status(200).json({ success: true, data: null });
});



// ── Two-factor authentication (TOTP) ────────────────────────────────────────

export const getTwoFactorStatus = asyncHandler(async (req, res) => {
  const data = await authService.twoFactorStatus({ userId: req.user.userId });
  res.status(200).json({ success: true, data });
});

export const setupTwoFactor = asyncHandler(async (req, res) => {
  const data = await authService.setupTwoFactor({
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data });
});

export const enableTwoFactor = asyncHandler(async (req, res) => {
  const data = parseBody(twoFactorCodeSchema, req.body);
  const result = await authService.enableTwoFactor({
    userId: req.user.userId,
    code: data.code,
  });
  res.status(200).json({ success: true, data: result });
});

export const disableTwoFactor = asyncHandler(async (req, res) => {
  const data = parseBody(twoFactorDisableSchema, req.body);
  const result = await authService.disableTwoFactor({
    userId: req.user.userId,
    code: data.code,
    password: data.password,
  });
  res.status(200).json({ success: true, data: result });
});

export const loginWithTwoFactor = asyncHandler(async (req, res) => {
  const data = parseBody(loginTwoFactorSchema, req.body);
  const result = await authService.loginWithTwoFactor({
    ticket: data.ticket,
    code: data.code,
    deviceInfo: deviceInfoFrom(req),
  });

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

// ── Email verification ──────────────────────────────────────────────────────

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.query.token;
  const result = await authService.verifyEmail({ token });
  res.status(200).json({ success: true, data: result });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification({
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: result });
});

// ── Password reset ──────────────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req, res) => {
  const data = parseBody(forgotPasswordSchema, req.body);
  const result = await authService.forgotPassword({ email: data.email });
  res.status(200).json({ success: true, data: result });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const data = parseBody(resetPasswordSchema, req.body);
  const result = await authService.resetPassword({
    token: data.token,
    newPassword: data.newPassword,
  });
  res.status(200).json({ success: true, data: result });
});
