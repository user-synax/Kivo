// Kivo service worker — manual registration, no Workbox.
// Handles Web Push (push) and notification clicks. No precache/offline shell yet.

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
  const payload = conversationId ? { type: "kivo:notification-click", conversationId } : null;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
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
    })()
  );
});

// Activate immediately so a just-installed SW controls the page without reload.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
