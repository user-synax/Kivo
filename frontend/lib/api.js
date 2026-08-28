// Thin fetch wrapper for the Kivo backend. Adds the bearer access token, parses
// the { success, data } envelope, and transparently retries once after a silent
// token refresh on 401. Throws an Error carrying `code`/`status` for callers.
import { clearSession, getToken, refreshAccessToken } from "./auth.js";

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}, { retry } = { retry: true }) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401 && retry) {
    // Access token likely expired — try one silent refresh, then retry.
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
      clearSession();
      throw new ApiError("Session expired", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new ApiError(
      json?.error?.message || `Request failed (${res.status})`,
      {
        status: res.status,
        code: json?.error?.code,
      },
    );
    throw err;
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
