// Web Push helpers — Phase 3. No auto-prompt; explicit user action drives permission.

import { apiDelete, apiGet, apiPost } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function requestPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications not supported");
  }
  const perm = await Notification.requestPermission();
  return perm; // "granted" | "denied" | "default"
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function subscribe() {
  if (typeof window === "undefined") throw new Error("No window");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push not supported");
  }
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  if (permission !== "granted") {
    // Caller should have called requestPermission() first via explicit user action.
    // We don't auto-prompt here.
    throw new Error("Notification permission not granted");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    // Already subscribed — ensure backend has it (idempotent POST)
    const json = existing.toJSON();
    await apiPost("/api/v1/push/subscribe", {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      expirationTime: json.expirationTime || null,
    });
    return existing;
  }

  const data = await apiGet("/api/v1/push/vapid-public-key");
  const publicKey = data?.publicKey;
  if (!publicKey) throw new Error("Missing VAPID public key");

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const json = sub.toJSON();
  await apiPost("/api/v1/push/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    expirationTime: json.expirationTime || null,
  });

  return sub;
}

export async function unsubscribe() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {}
  try {
    await apiDelete("/api/v1/push/unsubscribe", { endpoint });
  } catch {}
}

export async function syncSubscription() {
  // Called on app mount / login. Never prompts. Only auto-subscribes if
  // permission is already "granted" and no subscription exists yet.
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return;
    // Permission already granted, no sub — silently subscribe and sync to backend.
    await subscribe();
  } catch (err) {
    console.warn("[push] syncSubscription failed:", err?.message || err);
  }
}
