// shepherd.freq — offline service worker
// Precaches the whole app on first visit; afterwards it runs with no network.
// Bump VERSION whenever any precached file changes.
const VERSION = 'shepherd-v2';
const ASSETS = [
  './',
  'manifest.webmanifest',
  'assets/vista.webp',
  'assets/inter-var.woff2',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // pages: network first (so updates arrive), cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // assets: cache first, then network (and remember it)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
