/* Service worker — offline support for A Feijoa on Monday.
   Cache-first for everything in PRECACHE; runtime cache for fonts. */

const CACHE = 'feijoa-v3';
const IMG = [
  'bg-cover.jpg', 'bg-p1.jpg', 'bg-p2.jpg', 'bg-p3.jpg', 'bg-p4.jpg', 'bg-p5.jpg', 'bg-p6.jpg',
  'bg-p7.jpg', 'bg-p8.jpg', 'bg-p9.jpg', 'bg-p10.jpg', 'bg-p11.jpg', 'bg-p12.jpg',
  'egg-night.png', 'egg-day.png', 'egg-cracked.png', 'hatched.png',
  'feijoa-full.png', 'feijoa-hole.png', 'num-1.png', 'word-feijoa.png',
  'tamarillo-full.png', 'tamarillo-hole.png', 'num-2.png', 'word-tamarillo.png',
  'kiwi-full.png', 'kiwi-hole.png', 'num-3.png', 'word-kiwi.png',
  'nectarine-full.png', 'nectarine-hole.png', 'num-4.png', 'word-nectarine.png',
  'boysenberry-full.png', 'boysenberry-hole.png', 'num-5.png', 'word-boysenberry.png',
  'food-lamington-full.png', 'food-lamington-hole.png', 'food-hokey-pokey-full.png', 'food-hokey-pokey-hole.png',
  'food-pineapple-lump-full.png', 'food-pineapple-lump-hole.png', 'food-cheese-full.png', 'food-cheese-hole.png',
  'food-pepperoni-full.png', 'food-pepperoni-hole.png', 'food-gummy-bear-full.png', 'food-gummy-bear-hole.png',
  'food-mince-pie-full.png', 'food-mince-pie-hole.png', 'food-sausage-full.png', 'food-sausage-hole.png',
  'food-muffin-full.png', 'food-muffin-hole.png', 'food-rockmelon-full.png', 'food-rockmelon-hole.png',
  'cat-p8.png', 'cat-p9.png', 'cat-p10.png', 'leaf-full.png', 'leaf-hole.png',
  'cocoon-p11.png', 'cocoon-p12.png', 'butterfly.png',
  'arrow.png', 'arrow-cover.png', 'tap-hand.png', 'icon-192.png', 'icon-512.png'
];
const PRECACHE = [
  './', './index.html', './css/style.css', './js/audio.js', './js/story.js', './js/app.js',
  './manifest.webmanifest', ...IMG.map(f => './assets/img/' + f)
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
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
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const url = new URL(e.request.url);
        const cacheable =
          url.origin === location.origin ||
          url.hostname.endsWith('fonts.googleapis.com') ||
          url.hostname.endsWith('fonts.gstatic.com');
        if ((cacheable && res.ok) || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
