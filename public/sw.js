/*
 * ResQure service worker.
 * 1. Offline: keeps the SOS app screen (/sos) and its files on the phone, so it opens with no internet.
 * 2. Push: shows SOS notifications and opens the alert when tapped.
 */
const CACHE = "resqure-sos-v1";
const SHELL = ["/sos", "/manifest.webmanifest", "/app/sos-192.png", "/app/sos-512.png", "/app/sos-icon.svg"];

/** Cache /sos plus every /_next/static file its HTML references (scripts, styles). */
async function cacheShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const html = await (await cache.match("/sos")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  await Promise.all([...new Set(assets)].map((u) => cache.add(u).catch(() => {})));
}

self.addEventListener("install", (e) => e.waitUntil(cacheShell().catch(() => {}).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network; with no internet, open the cached SOS screen.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (url.pathname === "/sos" && res.ok) (await caches.open(CACHE)).put("/sos", res.clone());
        return res;
      } catch {
        return (await caches.match("/sos")) || Response.error();
      }
    })());
    return;
  }

  // Built files never change (hashed names): cache first. Icons/manifest: cache, refresh in background.
  if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then(async (res) => {
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "ResQure alert", body: event.data?.text() }; }
  const title = data.title || "ResQure SOS alert";
  const options = {
    body: data.body || "Someone near you needs help.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `sos-${data.code || Date.now()}`,
    renotify: true,
    requireInteraction: true, // stays on screen until tapped (Chrome, Edge, Android)
    vibrate: [600, 200, 600, 200, 600, 200, 1200], // long pattern; Android only
    data: { url: data.url || "/" },
    actions: data.kind === "sos" ? [{ action: "open", title: "See where" }] : [],
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // If the site is open in a tab, let it take over with the full-screen siren alert.
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const t of tabs) t.postMessage({ type: "resqure-alert", ...data });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = tabs.find((t) => t.url === url);
    if (same) return same.focus();
    return self.clients.openWindow(url);
  })());
});
