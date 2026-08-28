// Client-side session store for route guarding and the user-profile view.
//
// The access token intentionally stays in memory (it is short-lived and must
// not linger in localStorage). We persist only the non-sensitive user object so
// the app can (a) know a session exists for redirects and (b) render the profile
// without a backend round-trip. Real API calls should still use getToken().
const SESSION_KEY = "kivo:session";

let memoryToken = null;

export function setSession(user, token) {
  memoryToken = token || null;
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

export function clearSession() {
  memoryToken = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
}
