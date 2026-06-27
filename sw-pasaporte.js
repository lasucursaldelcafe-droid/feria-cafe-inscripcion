/* Service worker — Pasaporte Cafetero PWA (v3: resumen feria) */
var CACHE = 'pasaporte-cafetero-v3';
var SHELL = [
  '/pasaporte',
  '/pasaporte-cafetero.html',
  '/registro-fidelizacion',
  '/fidelizacion-registro.html',
  '/manifest-pasaporte.webmanifest',
  '/css/brand.css',
  '/css/fidelizacion.css',
  '/css/pasaporte.css',
  '/assets/logo-la-sucursal-del-cafe.png',
  '/js/sheets-config.js',
  '/js/site-links.js',
  '/js/event-config.js',
  '/js/fidelizacion-sheets.js',
  '/js/fidelizacion-db-shim.js',
  '/js/fidelizacion-common.js',
  '/js/firebase-fidelizacion-config.js',
  '/js/qr-render.js',
  '/js/pasaporte-pwa.js',
  '/js/pasaporte-feria.js'
];

function shellMatch(url) {
  return SHELL.some(function (path) {
    return url.pathname === path || url.pathname === path.replace(/\.html$/, '');
  });
}

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () { /* rutas pueden variar en local */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('pasaporte-cafetero-') === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match('/pasaporte-cafetero.html')
          .then(function (r) { return r || caches.match('/pasaporte'); });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (res) {
        if (res && res.status === 200 && (
          url.pathname.match(/\.(css|js|png|webmanifest)$/) || shellMatch(url)
        )) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(event.request, copy); });
        }
        return res;
      });
    })
  );
});
