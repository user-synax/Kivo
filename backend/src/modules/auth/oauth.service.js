import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { badRequest, conflict, unauthorized } from "../../utils/errors.js";
import User from "../../models/User.js";
import { issueSession, publicUser } from "./auth.service.js";

export const OAUTH_PROVIDERS = ["google", "github"];
const OAUTH_STATE_TTL = "10m";
const TWO_FACTOR_TICKET_TTL = "5m";

function assertProvider(provider) {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    throw badRequest("Unsupported OAuth provider", "UNSUPPORTED_PROVIDER");
  }
}

function providerConfig(provider) {
  if (provider === "google") {
    return {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      redirectUri: env.googleRedirectUri,
    };
  }
  return {
    clientId: env.githubClientId,
    clientSecret: env.githubClientSecret,
    redirectUri: env.githubRedirectUri,
  };
}

export function isOAuthConfigured(provider) {
  const cfg = providerConfig(provider);
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
}

// ── State (CSRF protection) ──────────────────────────────────────────────
// Short-lived signed JWT proving the callback belongs to a start we issued.
// Link flows embed the authenticated userId; login flows omit it.
export function signOAuthState({ provider, mode, userId = null }) {
  assertProvider(provider);
  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { type: "oauth_state", provider, mode, userId, nonce },
    env.accessTokenSecret,
    { expiresIn: OAUTH_STATE_TTL },
  );
}

export function verifyOAuthState(state, expectedProvider) {
  if (!state) throw badRequest("Missing OAuth state", "OAUTH_STATE_MISSING");
  let payload;
  try {
    payload = jwt.verify(state, env.accessTokenSecret);
  } catch {
    throw badRequest(
      "OAuth session expired. Please try again.",
      "OAUTH_STATE_EXPIRED",
    );
  }
  if (payload?.type !== "oauth_state" || payload?.provider !== expectedProvider) {
    throw badRequest("Invalid OAuth state", "OAUTH_STATE_INVALID");
  }
  if (!["login", "link"].includes(payload.mode)) {
    throw badRequest("Invalid OAuth state", "OAUTH_STATE_INVALID");
  }
  if (payload.mode === "link" && !payload.userId) {
    throw badRequest("Invalid OAuth link session", "OAUTH_STATE_INVALID");
  }
  return payload;
}

// ── Authorization URLs ───────────────────────────────────────────────────

export function buildAuthorizationUrl(provider, state) {
  assertProvider(provider);
  const cfg = providerConfig(provider);
  if (!cfg.clientId || !cfg.redirectUri) {
    throw badRequest(
      `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured yet`,
      "OAUTH_NOT_CONFIGURED",
    );
  }
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ── Provider profile fetch ───────────────────────────────────────────────

async function fetchGoogleProfile(code) {
  const cfg = providerConfig("google");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw badRequest("Google sign-in failed. Please try again.", "OAUTH_EXCHANGE_FAILED");
  }
  const tokens = await tokenRes.json();
  if (!tokens?.access_token) {
    throw badRequest("Google sign-in failed. Please try again.", "OAUTH_EXCHANGE_FAILED");
  }
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    throw badRequest("Could not read your Google profile.", "OAUTH_PROFILE_FAILED");
  }
  const info = await infoRes.json();
  if (!info?.sub || !info?.email) {
    throw badRequest("Google account did not return an email.", "OAUTH_NO_EMAIL");
  }
  return {
    providerId: String(info.sub),
    email: String(info.email).toLowerCase(),
    // Google only returns verified emails via userinfo when the account is
    // verified; treat the email as verified (drives isEmailVerified).
    displayName: info.name ? String(info.name).slice(0, 50) : null,
    avatarUrl: info.picture ? String(info.picture) : null,
    usernameHint: null,
  };
}

async function fetchGithubProfile(code) {
  const cfg = providerConfig("github");
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw badRequest("GitHub sign-in failed. Please try again.", "OAUTH_EXCHANGE_FAILED");
  }
  const tokens = await tokenRes.json();
  if (!tokens?.access_token) {
    throw badRequest("GitHub sign-in failed. Please try again.", "OAUTH_EXCHANGE_FAILED");
  }
  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Kivo-OAuth",
  };
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  if (!userRes.ok) {
    throw badRequest("Could not read your GitHub profile.", "OAUTH_PROFILE_FAILED");
  }
  const gh = await userRes.json();
  if (!gh?.id) {
    throw badRequest("Could not read your GitHub profile.", "OAUTH_PROFILE_FAILED");
  }
  let email = gh.email ? String(gh.email).toLowerCase() : null;
  if (emailsRes.ok) {
    try {
      const emails = await emailsRes.json();
      if (Array.isArray(emails) && emails.length > 0) {
        const primary = emails.find((e) => e.primary && e.verified)
          || emails.find((e) => e.verified)
          || emails.find((e) => e.primary)
          || emails[0];
        if (primary?.email) email = String(primary.email).toLowerCase();
        // Require at least one verified email so the badge means something.
        const anyVerified = emails.some((e) => e.verified);
        if (!anyVerified) {
          throw badRequest(
            "Your GitHub account has no verified email. Verify one on GitHub first.",
            "OAUTH_NO_VERIFIED_EMAIL",
          );
        }
      }
    } catch (e) {
      if (e?.statusCode) throw e;
      // Fall through to gh.email check below.
    }
  }
  if (!email) {
    throw badRequest(
      "GitHub did not share an email. Allow email access and try again.",
      "OAUTH_NO_EMAIL",
    );
  }
  return {
    providerId: String(gh.id),
    email,
    displayName: gh.name ? String(gh.name).slice(0, 50) : null,
    avatarUrl: gh.avatar_url ? String(gh.avatar_url) : null,
    usernameHint: gh.login ? String(gh.login) : null,
  };
}

export async function fetchProviderProfile(provider, code) {
  assertProvider(provider);
  if (!code) throw badRequest("Missing OAuth code", "OAUTH_CODE_MISSING");
  if (provider === "google") return fetchGoogleProfile(code);
  return fetchGithubProfile(code);
}

// ── Username generation ──────────────────────────────────────────────────

function sanitizeUsernameBase(raw) {
  const base = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : "kivo_user";
}

async function generateUniqueUsername(hints) {
  for (const hint of hints) {
    const base = sanitizeUsernameBase(hint);
    const existing = await User.findOne({ username: base }).select("_id").lean();
    if (!existing) return base;
  }
  const fallback = sanitizeUsernameBase(hints[0]);
  for (let i = 0; i < 20; i += 1) {
    const suffix = crypto.randomBytes(3).toString("hex").slice(0, 4);
    const candidate = `${fallback.slice(0, 24)}_${suffix}`;
    // eslint-disable-next-line no-await-in-loop -- sequential uniqueness probe
    const taken = await User.findOne({ username: candidate }).select("_id").lean();
    if (!taken) return candidate;
  }
  return `user_${Date.now().toString(36)}`;
}

// Native `verified` is earned only when BOTH provider badges are present
// (or previously granted by an admin — we never clear it once true).
function recomputeNativeVerified(user) {
  if (user.googleVerified && user.githubVerified && !user.verified) {
    user.verified = true;
  }
}

// ── Callback handling ────────────────────────────────────────────────────

function deviceInfoFromReq(req) {
  return {
    userAgent: req.headers["user-agent"] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
  };
}

function mintTwoFactorTicket(userId) {
  return jwt.sign({ type: "twofa", userId }, env.accessTokenSecret, {
    expiresIn: TWO_FACTOR_TICKET_TTL,
  });
}

function applyProviderLink(user, provider, profile) {
  if (provider === "google") {
    user.googleId = profile.providerId;
    user.googleEmail = profile.email;
    user.googleVerified = true;
  } else {
    user.githubId = profile.providerId;
    user.githubEmail = profile.email;
    user.githubVerified = true;
    // Remember the GitHub handle for the contribution graph if unset.
    if (!user.githubUsername && profile.usernameHint) {
      user.githubUsername = String(profile.usernameHint).slice(0, 39);
    }
  }
  // A provider-verified email is trustworthy — mark the account verified.
  user.isEmailVerified = true;
  recomputeNativeVerified(user);
}

// Main entry for GET /oauth/:provider/callback.
export async function handleOAuthCallback({ provider, code, state, req }) {
  assertProvider(provider);
  if (!isOAuthConfigured(provider)) {
    throw badRequest(
      `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured yet`,
      "OAUTH_NOT_CONFIGURED",
    );
  }
  const statePayload = verifyOAuthState(state, provider);
  const profile = await fetchProviderProfile(provider, code);

  // ── Link flow: authenticated user verifying a second provider ──
  if (statePayload.mode === "link") {
    const user = await User.findById(statePayload.userId).select(
      "+passwordHash googleId githubId googleEmail githubEmail googleVerified githubVerified verified isEmailVerified githubUsername isBanned",
    );
    if (!user) throw badRequest("Account not found. Please log in again.", "USER_NOT_FOUND");
    if (user.isBanned) throw unauthorized("This account has been suspended", "ACCOUNT_BANNED");

    const idField = provider === "google" ? "googleId" : "githubId";
    const conflictUser = await User.findOne({ [idField]: profile.providerId }).select("_id").lean();
    if (conflictUser && conflictUser._id.toString() !== user.id) {
      throw conflict(
        `This ${provider === "google" ? "Google" : "GitHub"} account is already linked to another Kivo account.`,
        "PROVIDER_ALREADY_LINKED",
      );
    }

    applyProviderLink(user, provider, profile);
    await user.save();
    return { kind: "linked", provider, user: publicUser(user) };
  }

  // ── Login / signup flow ──
  const idField = provider === "google" ? "googleId" : "githubId";
  let user = await User.findOne({ [idField]: profile.providerId }).select(
    "+passwordHash twoFactorEnabled",
  );
  if (user) {
    if (user.isBanned) throw unauthorized("This account has been suspended", "ACCOUNT_BANNED");
    // Refresh stored email/verified flags (user may have changed them).
    applyProviderLink(user, provider, profile);
    await user.save();
  } else {
    // Same email already has a Kivo account (local or other provider)?
    // Auto-link — the provider proved email ownership — so a local user who
    // clicks "Continue with Google" gets verified without a second step.
    user = await User.findOne({ email: profile.email }).select("+passwordHash twoFactorEnabled");
    if (user) {
      if (user.isBanned) throw unauthorized("This account has been suspended", "ACCOUNT_BANNED");
      const otherConflict = await User.findOne({ [idField]: profile.providerId }).select("_id").lean();
      if (otherConflict && otherConflict._id.toString() !== user.id) {
        throw conflict(
          `This ${provider === "google" ? "Google" : "GitHub"} account is already linked to another Kivo account.`,
          "PROVIDER_ALREADY_LINKED",
        );
      }
      applyProviderLink(user, provider, profile);
      if (!user.avatarUrl && profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
      await user.save();
    } else {
      // Brand-new account via OAuth — no password, email pre-verified.
      const emailPrefix = profile.email.split("@")[0];
      const username = await generateUniqueUsername([
        profile.usernameHint,
        emailPrefix,
        profile.displayName,
        `user_${profile.providerId.slice(-6)}`,
      ]);
      const fresh = {
        email: profile.email,
        username,
        displayName: profile.displayName || profile.usernameHint || emailPrefix.slice(0, 50),
        passwordHash: null,
        role: "user",
        isEmailVerified: true,
        avatarUrl: profile.avatarUrl || null,
        googleVerified: provider === "google",
        githubVerified: provider === "github",
        verified: false,
      };
      if (provider === "google") {
        fresh.googleId = profile.providerId;
        fresh.googleEmail = profile.email;
      } else {
        fresh.githubId = profile.providerId;
        fresh.githubEmail = profile.email;
        if (profile.usernameHint) fresh.githubUsername = String(profile.usernameHint).slice(0, 39);
      }
      user = await User.create(fresh);
    }
  }

  // 2FA gate mirrors password login: no session until the second factor.
  const full = await User.findById(user.id).select("twoFactorEnabled");
  if (full?.twoFactorEnabled) {
    return { kind: "login-2fa", ticket: mintTwoFactorTicket(user.id) };
  }

  const { accessToken, refreshToken } = await issueSession(user.id, deviceInfoFromReq(req));
  const sessionUser = await User.findById(user.id);
  return { kind: "login", user: publicUser(sessionUser), accessToken, refreshToken };
}
