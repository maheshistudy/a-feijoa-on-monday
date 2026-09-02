/* Service worker — offline support for A Feijoa on Monday.
   Cache-first for everything in PRECACHE; runtime cache for fonts. */

const CACHE = 'feijoa-v2';
const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/audio.js',
  './js/story.js',
  './js/app.js',
  './manifest.webmanifest',
  './assets/img/scene-title.jpg',
  './assets/img/scene-night.jpg',
  './assets/img/scene-day.jpg',
  './assets/img/egg-night.png',
  './assets/img/egg.png',
  './assets/img/caterpillar.png',
  './assets/img/arrow.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        // runtime-cache fonts and any same-origin file we missed
        const url = new URL(e.request.url);
        const cacheable =
          url.origin === location.origin ||
          url.hostname.endsWith('fonts.googleapis.com') ||
          url.hostname.endsWith('fonts.gstatic.com');
        if (cacheable && res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
