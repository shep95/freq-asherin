// shepherd.freq — offline service worker
// Precaches the whole app on first visit; afterwards it runs with no network.
// Bump VERSION whenever any precached file changes.
//
// Hardening: only same-origin GETs for an explicit allow-list are ever cached
// (no cache poisoning via arbitrary URLs or query strings), redirects and
// non-OK / non-basic responses are never stored, and cross-origin requests
// are not intercepted at all.
const VERSION = 'shepherd-v7';
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
const scopeURL = new URL(self.registration.scope);
const ALLOW = new Set(ASSETS.map(a => new URL(a, scopeURL).pathname));
const storable = res => res && res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload', credentials: 'omit' }))))
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
  if (url.origin !== scopeURL.origin) return;            // never touch other origins

  // pages: network first (so updates arrive), cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (storable(res) && url.pathname === scopeURL.pathname) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // assets: allow-listed paths only, cache first
  if (!ALLOW.has(url.pathname) || url.search) return;
  e.respondWith(
    caches.match(url.pathname).then(hit => hit || fetch(req).then(res => {
      if (storable(res)) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return res;
    }))
  );
});
