// Minimal service worker: cache the static app shell and provide an offline
// fallback page for navigations. Booking requires a live network connection
// and is intentionally NOT cached or supported offline.
const CACHE_NAME = "zoubou-shell-v3";
const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/logo.png",
  "/background.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle page navigations specially; everything else (API calls,
  // Next.js data/assets) goes straight to the network untouched.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }
});

// Appointment reminder (customer) / new-booking alert (admin) — both sent
// from the server as a small JSON payload { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "Zoubou", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Malformed/empty payload — fall back to the generic title above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Zoubou", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
