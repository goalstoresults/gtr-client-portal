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

  // Only handle http(s) - extensions (chrome-extension://, etc.) can't be cached

  if (!url.protocol.startsWith('http')) return;

  // Never cache API calls — always hit the network live
  if (url.hostname === 'client-portal-api.dennis-e64.workers.dev') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((networkRes) => {
          // stash a copy of successful GETs for next time (shell assets etc.)
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => {
          // network failed AND nothing cached for this exact URL —
          // fall back to the cached app shell instead of undefined
          return caches.match('/index.html').then((shell) => {
            return shell || new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        });
    })
  );
});
