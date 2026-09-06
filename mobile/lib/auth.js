// Secure session store for native.
// Web keeps the access token in memory + httpOnly refresh cookie.
// Native has neither — persist both in expo-secure-store (tokens)
// and keep the user object in memory + AsyncStorage for fast boot.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "kivo:accessToken";
const REFRESH_KEY = "kivo:refreshToken";
const USER_KEY = "kivo:user";
const THEME_KEY = "kivo:theme";

let memoryToken = null;
let memoryUser = null;
let refreshTimer = null;
let refreshFn = null;

export function setRefreshHandler(fn) {
  refreshFn = fn;
}

function decodeExpiry(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(
      globalThis.atob
        ? globalThis.atob(base64)
        : Buffer.from(base64, "base64").toString("utf8"),
    );
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh() {
  clearTimer();
  const exp = decodeExpiry(memoryToken);
  if (!exp || !refreshFn) return;
  const delay = Math.max(exp - Date.now() - 60_000, 5000);
  refreshTimer = setTimeout(() => {
    refreshFn().catch(() => clearTimer());
  }, delay);
}

export async function setSession(user, accessToken, refreshToken) {
  memoryUser = user || null;
  memoryToken = accessToken || null;
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_KEY);
    if (accessToken) await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    else await SecureStore.deleteItemAsync(ACCESS_KEY);
    // refreshToken is only returned by the backend for native clients
    // (see backend mobile-auth note in mobile/README.md). Until then it
    // stays cookie-based and this is a no-op.
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  } catch {
    // storage failures must never block login
  }
  if (memoryToken) scheduleRefresh();
}

export function getToken() {
  return memoryToken;
}

export function getUser() {
  return memoryUser;
}

export async function setToken(token) {
  memoryToken = token || null;
  try {
    if (token) await SecureStore.setItemAsync(ACCESS_KEY, token);
    else await SecureStore.deleteItemAsync(ACCESS_KEY);
  } catch {}
  if (memoryToken) scheduleRefresh();
  else clearTimer();
}

export async function getStoredRefreshToken() {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

// Cold boot: restore user + access token so the router can decide
// /(auth) vs /(tabs) without flashing the wrong stack.
export async function restoreSession() {
  try {
    const [rawUser, token] = await Promise.all([
      AsyncStorage.getItem(USER_KEY),
      SecureStore.getItemAsync(ACCESS_KEY),
    ]);
    memoryUser = rawUser
      ? (JSON.parse(rawUser)?.user ?? JSON.parse(rawUser))
      : null;
    // AsyncStorage holds either {user} or the user itself (back-compat).
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        memoryUser = parsed?.user ?? parsed;
      } catch {
        memoryUser = null;
      }
    }
    memoryToken = token || null;
    return { user: memoryUser, token: memoryToken };
  } catch {
    return { user: null, token: null };
  }
}

export async function clearSession() {
  memoryUser = null;
  memoryToken = null;
  clearTimer();
  try {
    await Promise.all([
      AsyncStorage.removeItem(USER_KEY),
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {}
}

export async function setStoredTheme(id) {
  try {
    await AsyncStorage.setItem(THEME_KEY, id);
  } catch {}
}

export async function getStoredTheme() {
  try {
    return await AsyncStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
