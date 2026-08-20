const CACHE = 'desafio-50-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './brand/logo.png', './brand/simbolo.png',
  './fonts/Seagram.ttf',
  './fonts/Cera Pro Light.otf', './fonts/Cera Pro Medium.otf',
  './fonts/Cera Pro Bold.otf', './fonts/Cera Pro Black.otf'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin && e.request.method === 'GET') {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
