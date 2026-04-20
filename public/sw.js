/* eslint-disable no-restricted-globals */
const CACHE = 'reputexa-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/manifest.json', '/reputexa-mark.svg']).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.get('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/'));
    })
  );
});

self.addEventListener('push', (event) => {
  let title = 'REPUTEXA';
  let body = '';
  try {
    const raw = event.data?.text();
    if (raw) {
      const j = JSON.parse(raw);
      title = j.title || title;
      body = j.body || body;
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(self.registration.showNotification(title, { body }));
});
