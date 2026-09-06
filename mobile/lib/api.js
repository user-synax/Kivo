// Thin fetch wrapper for the Kivo backend — native port of frontend/lib/api.js.
// Differences from web:
// - absolute URLs (API_URL), no Next.js rewrites
// - refresh token sent explicitly (SecureStore) until backend ships
//   cookie + body fallback for native (see mobile/README.md)

import {
  clearSession,
  getStoredRefreshToken,
  getToken,
  setToken,
} from "./auth";
import { API_URL, apiUrl } from "./config";

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// fetch() has no built-in timeout — without this an unreachable backend
// hangs forever (endless spinner). 15s then a clear, actionable error.
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new ApiError(
        `Couldn't reach the server at ${API_URL}. Check EXPO_PUBLIC_API_URL and that the backend is running.`,
        { status: 0, code: "NETWORK_TIMEOUT" },
      );
    }
    throw new ApiError(`Network error — couldn't reach ${API_URL}.`, {
      status: 0,
      code: "NETWORK_ERROR",
    });
  } finally {
    clearTimeout(timer);
  }
}

let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const storedRefresh = await getStoredRefreshToken();
      const res = await fetchWithTimeout(apiUrl("/api/v1/auth/refresh-token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storedRefresh ? { "x-refresh-token": storedRefresh } : {}),
        },
        // Cookie fallback: if backend still sets httpOnly cookie and the
        // native runtime persists it, include it too.
        body: storedRefresh
          ? JSON.stringify({ refreshToken: storedRefresh })
          : undefined,
      });
      if (!res.ok) {
        await clearSession();
        throw new Error("Session expired");
      }
      const json = await res.json();
      const token = json?.data?.accessToken;
      // Backend may also return a rotated refreshToken for native clients.
      const nextRefresh = json?.data?.refreshToken;
      if (!token) {
        await clearSession();
        throw new Error("Session expired");
      }
      const { setSession, getUser } = await import("./auth");
      await setSession(getUser(), token, nextRefresh || undefined);
      await setToken(token);
      return token;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request(path, options = {}, { retry } = { retry: true }) {
  const token = getToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetchWithTimeout(apiUrl(path), {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Only retry-with-refresh when we actually sent a token. Unauthenticated
  // calls (login/register) return 401 for wrong credentials — refreshing
  // there would mask the real error as "Session expired".
  if (res.status === 401 && retry && token) {
    try {
      const fresh = await refreshAccessToken();
      return request(
        path,
        {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${fresh}`,
          },
        },
        { retry: false },
      );
    } catch {
      await clearSession();
      throw new ApiError("Session expired", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(
      json?.error?.message || `Request failed (${res.status})`,
      {
        status: res.status,
        code: json?.error?.code,
      },
    );
  }
  return json.data;
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path, body) {
  return request(path, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiUpload(path, formData) {
  return request(path, { method: "PATCH", body: formData });
}

export function apiPostForm(path, formData) {
  return request(path, { method: "POST", body: formData });
}

export { refreshAccessToken };
