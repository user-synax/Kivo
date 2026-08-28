import env, { refreshTtlSeconds } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, registerSchema, loginSchema } from "./auth.validation.js";
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

export const register = asyncHandler(async (req, res) => {
  const data = parseBody(registerSchema, req.body);
  const result = await authService.registerUser(data);

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
