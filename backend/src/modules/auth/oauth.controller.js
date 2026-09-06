import env, { refreshTtlSeconds } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  parseParams,
  parseQuery,
  providerParamSchema,
  callbackQuerySchema,
  startQuerySchema,
} from "./oauth.validation.js";
import * as oauthService from "./oauth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.refreshCookieSameSite,
    path: env.refreshCookiePath,
    maxAge: refreshTtlSeconds() * 1000,
  });
}

function frontendBase() {
  return env.frontendUrl.replace(/\/+$/, "");
}

// Public: which provider buttons should the login/signup pages render?
export const providers = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      google: oauthService.isOAuthConfigured("google"),
      github: oauthService.isOAuthConfigured("github"),
    },
  });
});

// Public start: GET /oauth/:provider -> 302 to Google/GitHub (login/signup).
// Optional query (used by the native app):
//   ?redirect_uri=  device-reachable backend callback URL (same callback path)
//   ?return_to=     app deep link (kivo://oauth/callback) for the final hop
export const start = asyncHandler(async (req, res) => {
  const { provider } = parseParams(providerParamSchema, req.params);
  const startQuery = parseQuery(startQuerySchema, req.query);
  if (!oauthService.isOAuthConfigured(provider)) {
    const params = new URLSearchParams({
      oauth_error: "OAUTH_NOT_CONFIGURED",
      message: "Provider not configured",
    });
    return res.redirect(302, `${frontendBase()}/login?${params.toString()}`);
  }
  const redirectUri = oauthService.resolveProviderRedirectUri(provider, startQuery.redirect_uri);
  const state = oauthService.signOAuthState({
    provider,
    mode: "login",
    returnTo: startQuery.return_to || null,
    redirectUri,
  });
  const url = oauthService.buildAuthorizationUrl(provider, state, redirectUri);
  return res.redirect(302, url);
});

// Authenticated: POST /oauth/:provider/link-url -> { url } for the
// "Verify with Google/GitHub" buttons in Settings. The state embeds the
// userId so the callback can link without needing a Bearer header on a
// top-level navigation.
export const linkUrl = asyncHandler(async (req, res) => {
  const { provider } = parseParams(providerParamSchema, req.params);
  if (!oauthService.isOAuthConfigured(provider)) {
    return res.status(400).json({
      success: false,
      error: { code: "OAUTH_NOT_CONFIGURED", message: "Provider not configured" },
    });
  }
  const state = oauthService.signOAuthState({
    provider,
    mode: "link",
    userId: req.user.userId,
  });
  const url = oauthService.buildAuthorizationUrl(provider, state);
  res.status(200).json({ success: true, data: { url } });
});

// Public callback: GET /oauth/:provider/callback?code=&state=.
// Always ends in a redirect — JSON is never returned here because the request
// is a top-level browser navigation from the provider. Web flows land on
// /oauth/callback; native flows land on their return_to deep link
// (kivo://oauth/callback), which additionally receives the refreshToken
// because native has no shared cookie jar with the system browser.
export const callback = asyncHandler(async (req, res) => {
  const { provider } = parseParams(providerParamSchema, req.params);
  const query = parseQuery(callbackQuerySchema, req.query);

  // Prefer the signed returnTo from state (verified below); fall back to web.
  // An unverifiable state can never yield a trusted returnTo — it stays web.
  let returnTo = null;
  if (query.state) {
    try {
      const payload = oauthService.verifyOAuthState(query.state, provider);
      returnTo = payload.returnTo || null;
    } catch {
      returnTo = null;
    }
  }
  const isNative = typeof returnTo === "string" && !returnTo.startsWith("http");
  const base = returnTo || `${frontendBase()}/oauth/callback`;

  const redirectError = (code, message) => {
    const params = new URLSearchParams({ oauth_error: code, message: message || code });
    const sep = base.includes("?") ? "&" : "?";
    return res.redirect(302, `${base}${sep}${params.toString()}`);
  };

  // User denied consent at the provider.
  if (query.error) {
    return redirectError("OAUTH_CANCELLED", query.error_description || "Sign-in was cancelled.");
  }
  if (!query.code || !query.state) {
    return redirectError("OAUTH_INVALID", "Sign-in did not return a code. Please try again.");
  }

  try {
    const result = await oauthService.handleOAuthCallback({
      provider,
      code: query.code,
      state: query.state,
      req,
    });

    if (result.kind === "linked") {
      const params = new URLSearchParams({ linked: provider });
      const sep = base.includes("?") ? "&" : "?";
      return res.redirect(302, `${base}${sep}${params.toString()}`);
    }
    if (result.kind === "login-2fa") {
      const params = new URLSearchParams({ twoFactor: "1", ticket: result.ticket });
      const sep = base.includes("?") ? "&" : "?";
      return res.redirect(302, `${base}${sep}${params.toString()}`);
    }
    // Full login/signup — set the httpOnly refresh cookie, then hand the
    // short-lived access token to the callback page via query (it stores it
    // in memory via setSession and immediately strips it from the URL).
    // Native also gets the refreshToken in query (SecureStore) since the
    // system-browser cookie never reaches the app.
    setRefreshCookie(res, result.refreshToken);
    const params = new URLSearchParams({ accessToken: result.accessToken });
    if (isNative) params.set("refreshToken", result.refreshToken);
    const sep = base.includes("?") ? "&" : "?";
    return res.redirect(302, `${base}${sep}${params.toString()}`);
  } catch (e) {
    return redirectError(e?.code || "OAUTH_FAILED", e?.message || "Sign-in failed.");
  }
});
