// Client-side session store for route guarding and the user-profile view.
//
// The access token intentionally stays in memory (it is short-lived and must
// not linger in localStorage). We persist only the non-sensitive user object so
// the app can (a) know a session exists for redirects and (b) render the profile
// without a backend round-trip. Real API calls should still use getToken().
const SESSION_KEY = "kivo:session";

// Begin renewing the access token this many ms before it actually expires, so
// the user is never mid-request when it lapses.
const REFRESH_BUFFER_MS = 60_000;

let memoryToken = null;
let refreshTimer = null;

export function setSession(user, token) {
  memoryToken = token || null;
  if (memoryToken) scheduleTokenRefresh();
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user || null }));
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }
}

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).user || null;
  } catch {
    return null;
  }
}

export function getToken() {
  return memoryToken;
}

// Update only the in-memory access token (e.g. after a silent refresh). The
// user object is unchanged, so we leave localStorage as-is. Re-arms the
// auto-refresh timer for the new token's lifetime.
export function setToken(token) {
  memoryToken = token || null;
  if (memoryToken) scheduleTokenRefresh();
  else clearTokenRefresh();
}

export function clearSession() {
  let uid = null;
  try {
    const s = getSession();
    uid = s?.id || null;
  } catch {
    uid = null;
  }
  memoryToken = null;
  clearTokenRefresh();
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
  if (uid) {
    // Fire-and-forget: IDB clear must never block logout or throw.
    // Dynamic imports avoid circular dependencies (cache/outbox are standalone).
    import("./cache.js")
      .then((m) => m.clearUserCache(uid).catch(() => {}))
      .catch(() => {});
    import("./outbox.js").then((m) => m.resetOutbox()).catch(() => {});
  }
}

// Read the `exp` (epoch seconds) claim from an unsigned access token without
// verifying it — we only need the expiry to schedule the next silent refresh.
function decodeExpiry(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

async function doSilentRefresh() {
  try {
    await refreshAccessToken();
    // refreshAccessToken -> setToken re-arms the timer for the new token.
  } catch {
    clearTokenRefresh();
    // Session is gone; AuthGate/redirect will bounce the user to /login.
  }
}

// Schedule a single silent refresh just before the current access token expires.
// The timer re-arms itself after every successful refresh, keeping the session
// alive for the full life of the (7d) refresh cookie without user interaction.
function scheduleTokenRefresh() {
  clearTokenRefresh();
  const exp = decodeExpiry(memoryToken);
  if (!exp) return;
  // Refresh just before expiry, but never tighter than 5s (avoids a busy loop
  // if the configured TTL is extremely short).
  const delay = Math.max(exp - Date.now() - REFRESH_BUFFER_MS, 5000);
  refreshTimer = setTimeout(() => {
    doSilentRefresh();
  }, delay);
}

// Silently exchange the httpOnly refresh cookie for a fresh access token. The
// refresh cookie is sent automatically (credentials: "include"). Returns the new
// access token, or throws (and clears the session) if the refresh fails.
//
// Single-flight: concurrent callers (the proactive timer AND a reactive 401
// refresh) share one in-flight request so we never rotate/refresh twice at once.
let refreshInFlight = null;
export function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearSession();
        throw new Error("Session expired");
      }
      const json = await res.json();
      const token = json?.data?.accessToken;
      if (!token) {
        clearSession();
        throw new Error("Session expired");
      }
      setToken(token);
      return token;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
