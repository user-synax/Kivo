import crypto from "crypto";
import jwt from "jsonwebtoken";
import env, { refreshTtlSeconds } from "../../config/env.js";
import { getRedis } from "../../config/redis.js";
import { unauthorized, conflict, notFound } from "../../utils/errors.js";
import User from "../../models/User.js";

const SESSION_KEY = (sessionId) => `session:${sessionId}`;
const USER_SESSIONS_KEY = (userId) => `user_sessions:${userId}`;

function newSessionId() {
  return crypto.randomUUID();
}

// Persist the session record in Redis. This record is the SOURCE OF TRUTH for
// whether a refresh token is still valid. The refresh token is only a credential
// used to look the record up. Also maintains a per-user index set so we can
// revoke every session at once (logout-all / force-logout).
async function storeSession(sessionId, userId, deviceInfo) {
  const redis = getRedis();
  const sessionData = JSON.stringify({
    userId,
    createdAt: Date.now(),
    deviceInfo: deviceInfo || {},
  });
  const ttl = refreshTtlSeconds();

  await redis.set(SESSION_KEY(sessionId), sessionData, { EX: ttl });
  await redis.sAdd(USER_SESSIONS_KEY(userId), sessionId);
  // Keep the index set alive at least as long as the longest session.
  await redis.expire(USER_SESSIONS_KEY(userId), ttl);
  return sessionId;
}

async function destroySession(sessionId, userId) {
  const redis = getRedis();
  await redis.del(SESSION_KEY(sessionId));
  if (userId) {
    await redis.sRem(USER_SESSIONS_KEY(userId), sessionId);
  }
}

async function getSession(sessionId) {
  const raw = await getRedis().get(SESSION_KEY(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Issue a short-lived access token + long-lived refresh token, and create the
// backing Redis session. Returns the tokens (refresh token is opaque to the
// caller — it goes into an httpOnly cookie, never the response body).
async function issueSession(userId, deviceInfo) {
  const sessionId = newSessionId();

  const accessToken = jwt.sign({ userId, sessionId }, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl,
  });
  const refreshToken = jwt.sign({ sessionId }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl,
  });

  await storeSession(sessionId, userId, deviceInfo);
  return { accessToken, refreshToken, sessionId };
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username || null,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function registerUser({ email, username, password }) {
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
  const user = await User.create({ email, username, passwordHash, role: "user" });

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

  const ok = await user.comparePassword(password);
  if (!ok) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { accessToken, refreshToken } = await issueSession(user.id, deviceInfo);
  return { user: publicUser(user), accessToken, refreshToken };
}

// Rotate the refresh token: verify the supplied refresh token, ensure its
// session still exists in Redis, then atomically delete the old session and
// create a new one. If the session is gone (expired/revoked/already rotated),
// reject — forcing a fresh login.
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
    // Session missing => expired, revoked, or already rotated. Force re-login.
    throw unauthorized("Session invalid or expired", "SESSION_GONE");
  }

  // Rotation: destroy the old session before minting a new one.
  await destroySession(sessionId, session.userId);

  const { accessToken, refreshToken: newRefreshToken } = await issueSession(
    session.userId,
    session.deviceInfo
  );
  return { accessToken, refreshToken: newRefreshToken };
}

// Log out a single session (the current one, identified by the access token).
export async function logoutSession({ sessionId, userId }) {
  await destroySession(sessionId, userId);
}

// Revoke EVERY session for a user. Used by /logout-all (self) and by the admin
// force-logout route. This is the "force logout everywhere" primitive.
export async function logoutAllSessions({ userId }) {
  const redis = getRedis();
  const sessionIds = await redis.sMembers(USER_SESSIONS_KEY(userId));
  if (sessionIds.length > 0) {
    const pipeline = redis.multi();
    for (const id of sessionIds) {
      pipeline.del(SESSION_KEY(id));
    }
    pipeline.del(USER_SESSIONS_KEY(userId));
    await pipeline.exec();
  }
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
