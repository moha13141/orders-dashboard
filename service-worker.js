const CACHE_NAME = 'etg-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index-final.html',
  '/manifest.json',
  '/icon-512.png',
  '/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
