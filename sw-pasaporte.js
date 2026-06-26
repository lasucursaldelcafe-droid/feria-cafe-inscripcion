/* Service worker mínimo — Pasaporte Cafetero (caché de shell para uso offline básico) */
var CACHE = 'pasaporte-cafetero-v1';
var SHELL = [
  '/pasaporte-cafetero.html',
  '/css/brand.css',
  '/css/fidelizacion.css',
  '/css/pasaporte.css',
  '/assets/logo-la-sucursal-del-cafe.png',
  '/js/fidelizacion-common.js',
  '/js/qr-render.js',
  '/js/pasaporte-pwa.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () { /* hosting paths may vary */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (res) {
        if (res && res.status === 200 && url.pathname.match(/\.(css|js|png|webmanifest)$/)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        if (event.request.mode === 'navigate') {
          return caches.match('/pasaporte-cafetero.html');
        }
      });
    })
  );
});
