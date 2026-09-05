"use client";

// Register /sw.js once on app mount. Guarded for SSR and unsupported browsers.
// The service worker provides the offline shell (precache + network-first
// navigations with an offline.html fallback) and Web Push handling.
// This file intentionally does NOT subscribe to push — that wiring lands in Phase 3 (lib/push.js).
//
// Message protocol with the SW (public/sw.js):
//   → "KIVO_CLEAR_SHELL_CACHE"  clears the runtime + navigation caches
//   ← "KIVO_SHELL_CACHE_CLEARED" confirmation (currently unused; reserved for
//     a future "reset app cache" setting and multi-account safety valve).

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
      console.warn(
        "[pwa] service worker registration failed:",
        err?.message || err,
      );
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
