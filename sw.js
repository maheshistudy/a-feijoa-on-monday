/* Minimal offline cache so the book keeps working on a tablet with no wifi.
   Bump CACHE when you change files, or the tablet will keep the old version. */
const CACHE = 'pip-v1';
const FILES = [
  './', './index.html', './css/style.css', './js/audio.js', './js/story.js', './js/app.js',
  './assets/img/scene-night.jpg', './assets/img/scene-day.jpg', './assets/img/egg.png',
  './assets/img/caterpillar.png', './assets/img/arrow.png', './assets/img/icon-192.png',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    if (res.ok && e.request.url.startsWith(self.location.origin)) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
    return res;
  }).catch(() => r)));
});
