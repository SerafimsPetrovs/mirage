/* MIRAGE service worker.
 * Deliberately minimal: makes the site installable and shows a "no signal" screen when a page can't load
 * offline. It never caches app chunks, API responses or video (HLS) — live TV must always be fresh, and a
 * cached chunk would outlive a redeploy. Bump VERSION when offline.html or the icons change.
 */
const VERSION = "mirage-v1";
const OFFLINE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // offline page's own assets
  if (OFFLINE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  // page navigations: network first, "no signal" screen when offline
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});
