"use client";

// Register /sw.js once on app mount. Guarded for SSR and unsupported browsers.
// This file intentionally does NOT subscribe to push — that wiring lands in Phase 3 (lib/push.js).

let registered = false;

export function registerServiceWorker() {
  if (registered) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  registered = true;
  const swUrl = "/sw.js";

  // Defer to idle so registration never blocks first paint.
  const doRegister = () => {
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn("[pwa] service worker registration failed:", err?.message || err);
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(doRegister);
  } else {
    window.addEventListener("load", doRegister, { once: true });
    // If already loaded (e.g. client navigation), register on next tick
    if (document.readyState === "complete") setTimeout(doRegister, 0);
  }
}

export default registerServiceWorker;
