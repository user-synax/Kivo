// Kivo service worker — hand-rolled offline shell + Web Push (no Workbox).
//
// Strategy map (same-origin GETs only; everything else passes through):
//   Navigations (HTML)      network-first → last-good shell (kivo-pages) → offline.html
//   /_next/static/*         cache-first   → immutable, content-hashed build output
//   icons / fonts / images  stale-while-revalidate (kivo-runtime)
//   /api/*, /socket.io/*    NEVER intercepted — chat data uses the app's own
//                           IndexedDB cache + outbox (lib/cache.js, lib/outbox.js),
//                           so the SW must not serve personalized API responses
//                           from an HTTP cache (stale data across accounts).
//
// Precache (kivo-precache) holds only static, user-agnostic assets. The HTML
// shell itself is captured network-first on every online navigation, so the
// "offline shell" is always the last-known-good deploy the user actually saw.
//
// Bump SHELL_VERSION to purge all three caches on activate (e.g. after a
// breaking change to the shell) — old versions are deleted automatically.
//
// Push contract (kept compatible with dashboard-shell.jsx — do not change):
//   push              → showNotification(title, { body, icon, badge, data, tag })
//   notificationclick → focus an existing /app window and postMessage
//                       { type: "kivo:notification-click", conversationId },
//                       or open /app when no window exists.

const SHELL_VERSION = "v1";
const PRECACHE = `kivo-precache-${SHELL_VERSION}`;
const RUNTIME = `kivo-runtime-${SHELL_VERSION}`;
const PAGES = `kivo-pages-${SHELL_VERSION}`;
const KNOWN_CACHES = [PRECACHE, RUNTIME, PAGES];

// Static, user-agnostic assets safe to precache at install. The offline page
// must render with zero network, so it is always precached. HTML routes are
// intentionally NOT here — they are network-first navigations (see above).
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Destinations that are always public static assets. RSC payload fetches
// (destination "") and XHR (destination "empty") are excluded on purpose.
const STATIC_DESTINATIONS = new Set([
  "script",
  "style",
  "image",
  "font",
  "manifest",
]);

// ── Install: precache the offline shell assets (best-effort per file) ───────

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Individual adds (not addAll) so one missing asset can't fail the
      // whole install — offline.html is the only critical one.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      self.skipWaiting();
    })(),
  );
});

// ── Activate: claim clients + purge caches from previous shell versions ─────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("kivo-") && !KNOWN_CACHES.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── Fetch: routing ──────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // mutations always hit the network

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Cross-origin (Appwrite files, etc.) and browser-internal schemes: ignore.
  if (url.origin !== self.location.origin) return;
  // Realtime + personalized API: never cached, never answered from cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io"))
    return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(event, req, url));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    // Content-hashed + immutable: cache-first is safe forever.
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }

  if (STATIC_DESTINATIONS.has(req.destination)) {
    event.respondWith(staleWhileRevalidate(event, req, RUNTIME));
  }
  // Anything else (RSC payloads, fetch/XHR, unknown): default network.
});

// ── Strategies ──────────────────────────────────────────────────────────────

// Navigations: try the network first so online users always get the newest
// deploy; store the fresh shell keyed by pathname (query ignored — Next.js
// serves one HTML per route, so /app?join=CODE and /app share an entry).
// Offline: last-good shell for this route → any cached shell → offline.html.
async function handleNavigation(event, req, url) {
  const cache = await caches.open(PAGES);
  const key = url.origin + url.pathname; // normalized: no query string

  try {
    const res = await fetch(req);
    if (res?.ok) {
      // Key by the final URL's pathname in case the server redirected.
      // waitUntil keeps the SW alive until the fresh shell is stored.
      event.waitUntil(
        (async () => {
          let finalPath = key;
          try {
            if (res.url)
              finalPath = new URL(res.url).origin + new URL(res.url).pathname;
          } catch {
            // keep normalized request key
          }
          await cache.put(finalPath, res.clone()).catch(() => {});
        })(),
      );
    }
    return res;
  } catch {
    // Network failed — fall through to cached shells.
  }

  const sameRoute = await cache.match(key).catch(() => null);
  if (sameRoute) return sameRoute;

  const keys = await cache.keys().catch(() => []);
  if (keys.length > 0) {
    const anyShell = await cache.match(keys[0]).catch(() => null);
    if (anyShell) return anyShell;
  }

  const offline = await caches
    .open(PRECACHE)
    .then((c) => c.match("/offline.html"))
    .catch(() => null);
  return (
    offline ||
    new Response("You are offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req).catch(() => null);
  if (cached) return cached;

  const res = await fetch(req).catch(() => null);
  if (res?.ok) cache.put(req, res.clone()).catch(() => {});
  return res || new Response("", { status: 504, statusText: "Offline" });
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req).catch(() => null);
  const refresh = fetch(req)
    .then((res) => {
      if (res?.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  // Keep the SW alive until the revalidate finishes, but serve cache now.
  event.waitUntil(refresh.then(() => {}).catch(() => {}));
  if (cached) return cached;
  const res = await refresh;
  return res || new Response("", { status: 504, statusText: "Offline" });
}

// ── Messages: version upgrades + manual shell-cache purge ───────────────────

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "KIVO_CLEAR_SHELL_CACHE") {
    // Clears runtime + navigation caches (precached offline.html survives so
    // the fallback stays available). Reserved for future "reset app cache"
    // settings and multi-account safety valves.
    event.waitUntil(
      (async () => {
        await Promise.all([caches.delete(RUNTIME), caches.delete(PAGES)]);
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients)
          client.postMessage({ type: "KIVO_SHELL_CACHE_CLEARED" });
      })(),
    );
  }
});

// ── Web Push (unchanged contract — see header) ──────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data ? event.data.text() : "" };
    } catch {
      data = {};
    }
  }

  const title = data.title || "Kivo";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    data: data.data || {},
    tag: data.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification?.data?.conversationId || null;
  const targetUrl = "/app";
  const payload = conversationId
    ? { type: "kivo:notification-click", conversationId }
    : null;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Try to focus an existing Kivo window
      for (const client of allClients) {
        if (client.url.includes("/app") && "focus" in client) {
          await client.focus();
          if (payload && client.postMessage) client.postMessage(payload);
          return;
        }
      }
      // No existing window — open a new one
      if (self.clients.openWindow) {
        const win = await self.clients.openWindow(targetUrl);
        // postMessage after open is not reliably deliverable across navigation; the
        // conversationId is also available as notification data if needed on next load.
        void win;
      }
    })(),
  );
});
