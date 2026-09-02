import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import env, { refreshTtlSeconds } from "../../config/env.js";
import { unauthorized, conflict, notFound, badRequest } from "../../utils/errors.js";
import User from "../../models/User.js";
import Session from "../../models/Session.js";
import { sendEmail } from "../../lib/email.js";

// ── Token helpers ───────────────────────────────────────────────────────────

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildFrontendUrl(path) {
  const base = env.frontendUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

// ── Email templates ─────────────────────────────────────────────────────────

function verificationEmailHtml({ displayName, verifyUrl }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 8px;font-size:24px;color:#1a1a1a;">Verify your email</h1>
    <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
      Hi${displayName ? ` ${displayName}` : ""}, welcome to Kivo! Please confirm your email address to get started.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:#7a40ed;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:9999px;">
      Verify Email
    </a>
    <p style="margin:32px 0 0;color:#999;font-size:13px;line-height:1.6;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
}

function passwordResetEmailHtml({ displayName, resetUrl }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 8px;font-size:24px;color:#1a1a1a;">Reset your password</h1>
    <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
      Hi${displayName ? ` ${displayName}` : ""}, we received a request to reset your password. Click the button below to choose a new one.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#7a40ed;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:9999px;">
      Reset Password
    </a>
    <p style="margin:32px 0 0;color:#999;font-size:13px;line-height:1.6;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
}

// ── Session helpers ─────────────────────────────────────────────────────────

// Persist the session record in MongoDB. This record is the SOURCE OF TRUTH for
// whether a refresh token is still valid. The refresh token only references it.
async function storeSession(userId, deviceInfo) {
  const ttlMs = refreshTtlSeconds() * 1000;
  const session = await Session.create({
    userId,
    deviceInfo: deviceInfo || {},
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return session._id.toString();
}

async function destroySession(sessionId, userId) {
  await Session.deleteOne({ _id: sessionId, userId });
}

async function getSession(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) return null;
  // Defensive check in case the TTL sweep has not run yet.
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    await Session.deleteOne({ _id: sessionId }).catch(() => {});
    return null;
  }
  return {
    userId: session.userId.toString(),
    createdAt: session.createdAt?.getTime?.() ?? Date.now(),
    deviceInfo: session.deviceInfo || {},
  };
}

// Issue a short-lived access token + long-lived refresh token, and create the
// backing session document. Returns the tokens (refresh token is opaque to the
// caller — it goes into an httpOnly cookie, never the response body).
async function issueSession(userId, deviceInfo) {
  const sessionId = await storeSession(userId, deviceInfo);

  const accessToken = jwt.sign({ userId, sessionId }, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl,
  });
  const refreshToken = jwt.sign({ sessionId }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl,
  });

  return { accessToken, refreshToken, sessionId };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || null,
    username: user.username || null,
    bio: user.bio || null,
    status: user.status || null,
    avatarStyle: user.avatarStyle || null,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
    isEmailVerified: user.isEmailVerified || false,
    createdAt: user.createdAt,
  };
}

// ── Registration (with email verification) ──────────────────────────────────

export async function registerUser({ email, username, password, displayName }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw conflict("Email already registered", "EMAIL_TAKEN");
  }
  if (username) {
    const taken = await User.findOne({ username });
    if (taken) {
      throw conflict("Username already taken", "USERNAME_TAKEN");
    }
  }

  const passwordHash = await User.hashPassword(password);

  // Generate email verification token (24h expiry)
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Role is ALWAYS assigned server-side; never taken from the request body.
  const user = await User.create({
    email,
    username,
    displayName,
    passwordHash,
    role: "user",
    isEmailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: verificationExpires,
  });

  // Send verification email (fire-and-forget — don't block registration)
  const verifyUrl = buildFrontendUrl(`/verify-email?token=${rawToken}`);
  sendEmail({
    to: email,
    subject: "Verify your email — Kivo",
    html: verificationEmailHtml({ displayName: displayName || "", verifyUrl }),
  }).catch((err) => {
    console.error("[email] Failed to send verification email:", err.message);
  });

  const deviceInfo = {};
  const { accessToken, refreshToken } = await issueSession(user.id, deviceInfo);
  return { user: publicUser(user), accessToken, refreshToken };
}

// ── Login ───────────────────────────────────────────────────────────────────

export async function loginUser({ identifier, password, deviceInfo }) {
  // Look up by email or username. Select passwordHash explicitly (it is hidden
  // by default via select:false). Generic error avoids user enumeration.
  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
  }).select("+passwordHash");

  if (!user) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  // Defense in depth: reject banned users at login even if the socket layer
  // also disconnects them immediately on ban.
  if (user.isBanned) {
    throw unauthorized(
      "This account has been suspended",
      "ACCOUNT_BANNED",
    );
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { accessToken, refreshToken } = await issueSession(user.id, deviceInfo);
  return { user: publicUser(user), accessToken, refreshToken };
}

// ── Refresh ─────────────────────────────────────────────────────────────────

// Rotate the refresh token: verify the supplied refresh token, ensure its
// session still exists in the store, then atomically delete the old session and
// Mint a fresh access token from a still-valid refresh token. We intentionally
// do NOT rotate the refresh token here: rotation destroys the session document
// and re-issues a new httpOnly cookie, which is fragile in the browser (a
// concurrent refresh race can leave the stored cookie pointing at a dead
// session, causing an immediate logout on the next load). The single refresh
// cookie stays valid for its full TTL and is only revoked on explicit logout.
export async function refreshSession({ refreshToken }) {
  if (!refreshToken) {
    throw unauthorized("Missing refresh token", "NO_REFRESH_TOKEN");
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.refreshTokenSecret);
  } catch {
    throw unauthorized("Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const sessionId = payload.sessionId;
  if (!sessionId) {
    throw unauthorized("Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const session = await getSession(sessionId);
  if (!session) {
    // Session missing => expired or revoked. Force re-login.
    throw unauthorized("Session invalid or expired", "SESSION_GONE");
  }

  // Issue a new short-lived access token, but keep the same refresh token/cookie.
  const accessToken = jwt.sign(
    { userId: session.userId, sessionId },
    env.accessTokenSecret,
    { expiresIn: env.accessTokenTtl },
  );
  return { accessToken, refreshToken };
}

// ── Logout ──────────────────────────────────────────────────────────────────

// Log out a single session (the current one, identified by the access token).
export async function logoutSession({ sessionId, userId }) {
  await destroySession(sessionId, userId);
}

// Revoke EVERY session for a user. Used by /logout-all (self) and by the admin
// force-logout route. This is the "force logout everywhere" primitive.
export async function logoutAllSessions({ userId }) {
  await Session.deleteMany({ userId });
}

// Convenience wrapper used by admin routes to force-logout a target user.
export async function forceLogoutUser({ userId }) {
  const exists = await User.exists({ _id: userId });
  if (!exists) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }
  await logoutAllSessions({ userId });
  return { revoked: true };
}

// ── Email verification ──────────────────────────────────────────────────────

export async function verifyEmail({ token }) {
  if (!token) {
    throw badRequest("Verification token is required", "MISSING_TOKEN");
  }

  const tokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationTokenHash +emailVerificationExpires");

  if (!user) {
    throw badRequest(
      "Invalid or expired verification link",
      "INVALID_VERIFICATION_TOKEN",
    );
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return { verified: true };
}

// ── Resend verification ─────────────────────────────────────────────────────

export async function resendVerification({ userId }) {
  const user = await User.findById(userId).select(
    "+emailVerificationTokenHash +emailVerificationExpires",
  );
  if (!user) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  if (user.isEmailVerified) {
    return { sent: true }; // Already verified — no-op
  }

  // Check rate-limit: 1 per minute per user (caller should also rate-limit)
  if (
    user.emailVerificationExpires &&
    user.emailVerificationExpires.getTime() > Date.now() - 59 * 60 * 1000
  ) {
    // Token was issued less than 59 minutes ago — still valid, don't reissue
    // frequently. Allow it if more than 1 minute has passed.
    const issuedAgo = Date.now() - (user.emailVerificationExpires.getTime() - 24 * 60 * 60 * 1000);
    if (issuedAgo < 60 * 1000) {
      return { sent: true }; // Don't spam — already sent recently
    }
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = verificationExpires;
  await user.save();

  const verifyUrl = buildFrontendUrl(`/verify-email?token=${rawToken}`);
  sendEmail({
    to: user.email,
    subject: "Verify your email — Kivo",
    html: verificationEmailHtml({
      displayName: user.displayName || "",
      verifyUrl,
    }),
  }).catch((err) => {
    console.error("[email] Failed to resend verification email:", err.message);
  });

  return { sent: true };
}

// ── Forgot password ─────────────────────────────────────────────────────────

export async function forgotPassword({ email }) {
  // Always return success to avoid leaking account existence.
  if (!email) return { sent: true };

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordResetTokenHash +passwordResetExpires",
  );

  if (user) {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = resetExpires;
    await user.save();

    const resetUrl = buildFrontendUrl(`/reset-password?token=${rawToken}`);
    sendEmail({
      to: user.email,
      subject: "Reset your password — Kivo",
      html: passwordResetEmailHtml({
        displayName: user.displayName || "",
        resetUrl,
      }),
    }).catch((err) => {
      console.error("[email] Failed to send password reset email:", err.message);
    });
  }

  return { sent: true };
}

// ── Reset password ──────────────────────────────────────────────────────────

export async function resetPassword({ token, newPassword }) {
  if (!token) {
    throw badRequest("Reset token is required", "MISSING_TOKEN");
  }

  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select(
    "+passwordHash +passwordResetTokenHash +passwordResetExpires",
  );

  if (!user) {
    throw badRequest(
      "Invalid or expired reset link",
      "INVALID_RESET_TOKEN",
    );
  }

  // Update password
  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  await user.save();

  // Invalidate all existing sessions (force re-login everywhere)
  await Session.deleteMany({ userId: user._id });

  return { reset: true };
}
