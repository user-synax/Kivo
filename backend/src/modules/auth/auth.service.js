import jwt from "jsonwebtoken";
import env, { refreshTtlSeconds } from "../../config/env.js";
import { unauthorized, conflict, notFound } from "../../utils/errors.js";
import User from "../../models/User.js";
import Session from "../../models/Session.js";

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
    createdAt: user.createdAt,
  };
}

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
  // Role is ALWAYS assigned server-side; never taken from the request body.
  const user = await User.create({
    email,
    username,
    displayName,
    passwordHash,
    role: "user",
  });

  const deviceInfo = {};
  const { accessToken, refreshToken } = await issueSession(user.id, deviceInfo);
  return { user: publicUser(user), accessToken, refreshToken };
}

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
