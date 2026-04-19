/**
 * P0.6 - Lead Engine PWA service worker.
 *
 * Goals:
 *   1. "Add to Home Screen" works on iOS/Android (register + manifest).
 *   2. Cached lead detail view loads instantly when the device hits a dead spot
 *      between two prospect visits in Camden / Hackney (ICP4 use case).
 *   3. Push notifications hook ready (lead reply geldi / yakindaki yeni lead).
 *
 * Strategy:
 *   - HTML / app shell        → network-first, fallback cached
 *   - /api/leads/* GET         → stale-while-revalidate (instant render, refresh in bg)
 *   - /api/* mutations         → network-only (never cache POST/PATCH/DELETE)
 *   - Static assets            → cache-first
 */

const CACHE_VERSION = "le-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = ["/", "/app/leads", "/app/discovery", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => null)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never cache mutations or non-GET.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin: pass through, no cache.
  if (url.origin !== self.location.origin) return;

  // Auth endpoints + Supabase: never cache.
  if (url.pathname.startsWith("/auth") || url.pathname.includes("/api/billing/webhook")) {
    return;
  }

  // /api/leads/* GET → stale-while-revalidate so the lead detail loads instantly
  // from cache even on a flaky 4G connection in a London side street, and the
  // updated version arrives in the background.
  if (url.pathname.startsWith("/api/leads/") || url.pathname.startsWith("/api/reviews/")) {
    event.respondWith(staleWhileRevalidate(req, API_CACHE));
    return;
  }

  // Static assets / Next.js _next/static / fonts → cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // App shell HTML → network-first with cache fallback.
  if (req.destination === "document" || url.pathname.startsWith("/app")) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }
});

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(cacheName);
    cache.put(req, fresh.clone()).catch(() => null);
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response("Offline. Reconnect to continue.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  const cache = await caches.open(cacheName);
  cache.put(req, fresh.clone()).catch(() => null);
  return fresh;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((fresh) => {
      cache.put(req, fresh.clone()).catch(() => null);
      return fresh;
    })
    .catch(() => null);
  return cached || networkPromise || new Response("Offline", { status: 503 });
}

// Push notification hook (P0.6 push infra ready).
// Server posts to /api/push/send with {title, body, leadId}; SW renders here.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = (() => {
    try {
      return event.data.json();
    } catch {
      return { title: "Lead Engine", body: event.data.text() };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data.title || "Lead Engine", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.leadId ? `/app/leads/${data.leadId}` : "/app/leads" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/leads";
  event.waitUntil(self.clients.openWindow(url));
});
