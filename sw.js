const CACHE_NAME = 'redumbrella-shell-v4';

self.addEventListener('install', (event) => {
  // Nothing precached - there's no cache to warm.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Wipe every existing cache from any prior version of this file -
  // no exceptions, since this version keeps none of its own.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Intentionally empty. No caching at all, at any layer - every
  // request goes straight to the network, every time, full stop.
  // This handler exists only so the browser sees a registered
  // service worker with a fetch listener, which is required for
  // "Add to Home Screen" / PWA installability. It never touches
  // the request or response, so this is functionally identical to
  // having no service worker at all from the app's perspective -
  // stale data becomes structurally impossible, not just unlikely.
});
