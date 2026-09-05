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
  appwriteAttachmentsBucketId: process.env.APPWRITE_ATTACHMENTS_BUCKET_ID || "",

  vapidPublicKey: required("VAPID_PUBLIC_KEY", process.env.VAPID_PUBLIC_KEY),
  vapidPrivateKey: required("VAPID_PRIVATE_KEY", process.env.VAPID_PRIVATE_KEY),
  vapidSubject: required("VAPID_SUBJECT", process.env.VAPID_SUBJECT),

  // Gmail SMTP for transactional email (verification, password reset, etc.).
  gmailUser: process.env.GMAIL_USER || "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || "",

  // Frontend base URL for building email verification / reset links.
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // OAuth — Google & GitHub signup/login + account verification.
  // Get Google creds at https://console.cloud.google.com/apis/credentials
  // Get GitHub creds at https://github.com/settings/developers
  // Redirect URIs default to the frontend origin (proxied via Next rewrites
  // to the backend), e.g. http://localhost:3000/api/v1/auth/oauth/google/callback.
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || "http://localhost:3000"}/api/v1/auth/oauth/google/callback`,
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  githubRedirectUri:
    process.env.GITHUB_REDIRECT_URI ||
    `${process.env.FRONTEND_URL || "http://localhost:3000"}/api/v1/auth/oauth/github/callback`,

  // LiveKit (voice & video calls via LiveKit Cloud). Optional like
  // Appwrite — the server boots without them; POST /api/v1/calls/token
  // reports CALLS_NOT_CONFIGURED until they're set. Get keys at
  // https://cloud.livekit.io (project Settings → Keys).
  livekitUrl: process.env.LIVEKIT_URL || "",
  livekitApiKey: process.env.LIVEKIT_API_KEY || "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || "",

  // Admin panel — standalone credential pair, NOT a DB user account.
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || process.env.ACCESS_TOKEN_SECRET + "_admin",
  adminJwtTtl: process.env.ADMIN_JWT_TTL || "30m",
  adminCookieName: process.env.ADMIN_COOKIE_NAME || "admin_token",
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
