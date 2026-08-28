const CACHE = 'desafio-50-v3';
const ASSETS = [
  './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './brand/logo.png', './brand/simbolo.png',
  './fonts/Seagram.ttf',
  './fonts/Cera Pro Light.otf', './fonts/Cera Pro Medium.otf',
  './fonts/Cera Pro Bold.otf', './fonts/Cera Pro Black.otf'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const ehPagina = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (ehPagina) {
    /* a pagina sempre vem da rede, para as alteracoes chegarem na hora */
    e.respondWith(
      fetch(e.request).then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  /* fontes, icones e imagens continuam vindo do cache, que e o que deixa o aplicativo rapido */
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
