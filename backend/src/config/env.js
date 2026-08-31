import dotenv from "dotenv";

dotenv.config();

function required(name, value) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,

  mongoUri: required("MONGODB_URI", process.env.MONGODB_URI),

  // Comma-separated list of allowed CORS origins. Left unset to allow any
  // origin (reflective) for local dev — set explicitly in production.
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || "",

  accessTokenSecret: required("ACCESS_TOKEN_SECRET", process.env.ACCESS_TOKEN_SECRET),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET),

  // Access token lifetime, e.g. "15m". Parsed by jsonwebtoken as a string.
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",

  // Refresh token lifetime, e.g. "7d", "30d".
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",

  // Refresh cookie hardening. "strict" or "lax".
  refreshCookieSameSite: process.env.REFRESH_COOKIE_SAMESITE || "strict",
  refreshCookiePath: "/api/v1/auth",

  // Appwrite Storage (avatar uploads). All optional — the server runs without
  // them; the avatar upload endpoint returns a clear error until they're set.
  appwriteEndpoint: process.env.APPWRITE_ENDPOINT || "",
  appwriteProjectId: process.env.APPWRITE_PROJECT_ID || "",
  appwriteApiKey: process.env.APPWRITE_API_KEY || "",
  appwriteBucketId: process.env.APPWRITE_BUCKET_ID || "",

  vapidPublicKey: required("VAPID_PUBLIC_KEY", process.env.VAPID_PUBLIC_KEY),
  vapidPrivateKey: required("VAPID_PRIVATE_KEY", process.env.VAPID_PRIVATE_KEY),
  vapidSubject: required("VAPID_SUBJECT", process.env.VAPID_SUBJECT),
};

// Convenience: seconds for the Redis session TTL, derived from refresh token TTL.
export function refreshTtlSeconds() {
  const raw = env.refreshTokenTtl;
  const match = /^(\d+)\s*(s|m|h|d|w)$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid REFRESH_TOKEN_TTL value: "${raw}"`);
  }
  const value = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2]];
  return value * unitSeconds;
}

export const isProduction = env.nodeEnv === "production";

export default env;
