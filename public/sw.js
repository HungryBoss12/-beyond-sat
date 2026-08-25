/* BeyondSAT PWA service worker — network-first for pages, cache for static assets. */
const CACHE = "beyondsat-static-v4";
const PRECACHE = [
  "/offline.html",
  "/offline-tetris.js",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-192x192.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* Per-URL add so one missing asset does not abort the whole install. */
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isBypass(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/signin") ||
    url.pathname.startsWith("/signup")
  );
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_build/")) return true;
  return /\.(?:js|css|woff2?|svg|png|ico|webp|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("/offline.html")) ?? Response.error();
      }),
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
