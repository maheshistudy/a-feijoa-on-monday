/* Service worker — offline support for A Feijoa on Monday.
   Precaches the shell, every image and every recording listed in the generated
   js/layout.js, then serves cache-first. Not used by the downloadable bundle
   (which is already offline and runs from file://). */

importScripts('js/layout.js');

const CACHE = 'feijoa-v4';
const PRECACHE = [
  './', './index.html', './css/style.css',
  './js/layout.js', './js/audio.js', './js/story.js', './js/app.js',
  './manifest.webmanifest',
  ...Object.values(LAYOUT.img).map(i => './assets/img/' + i.file),
  ...Object.values(LAYOUT.captions).map(c => './assets/img/' + c.file),
  ...Object.values(LAYOUT.audio).map(f => './assets/audio/' + f),
  './assets/img/icon-192.png', './assets/img/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...new Set(PRECACHE)])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // range requests (audio seeking) go straight to the network/cache API
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const url = new URL(e.request.url);
        if (url.origin === location.origin && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
