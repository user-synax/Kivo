import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { apiGet } from "./api";
import { apiUrl } from "./config";

// Deep link the backend redirects to after the provider round-trip.
// Linking.createURL resolves to kivo://oauth/callback in dev builds and the
// exp:// URL in Expo Go — both are allowlisted server-side (assertReturnTo).
export function oauthReturnUrl() {
  return Linking.createURL("oauth/callback");
}

// Which provider buttons should render? Mirrors the web login/signup pages.
export async function oauthProviders() {
  try {
    const data = await apiGet("/api/v1/auth/oauth/providers");
    return { google: Boolean(data?.google), github: Boolean(data?.github) };
  } catch {
    return { google: true, github: true };
  }
}

// Open the backend OAuth start endpoint in a system-browser auth session.
// Resolves when the session completes or the user dismisses it — the actual
// sign-in is handled by app/oauth/callback.js via the deep link.
export async function startOAuth(provider) {
  const callbackPath = `/api/v1/auth/oauth/${provider}/callback`;
  const startUrl =
    `${apiUrl(`/api/v1/auth/oauth/${provider}`)}` +
    `?redirect_uri=${encodeURIComponent(apiUrl(callbackPath))}` +
    `&return_to=${encodeURIComponent(oauthReturnUrl())}`;
  return WebBrowser.openAuthSessionAsync(startUrl, oauthReturnUrl());
}
