const CACHE_NAME = 'redumbrella-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Never intercept page navigations — let the browser load these normally
  if (req.mode === 'navigate') return;

  const url = new URL(req.url);

  // Never cache API calls — always hit the network live
  if (url.hostname === 'client-portal-api.dennis-e64.workers.dev') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).catch(() => cached);
    })
  );
});
