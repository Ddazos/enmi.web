/* ============================================================
   SERVICE WORKER — Mi Momento
   Estrategia: cache-first para el "app shell" (todo vive en un
   único HTML autocontenido, así que cachear ese archivo ya
   cubre toda la app funcionando offline).

   Cuando cambies algo en index.html, sube el numero de CACHE_VERSION
   para forzar a los usuarios a descargar la version nueva.
============================================================ */
const CACHE_VERSION = 'mimomento-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET del propio origen (no las de
  // Google Fonts ni otros externos, esas se dejan pasar tal cual)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Guardamos en cache una copia de lo que sí se pueda cachear
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin conexion y sin copia en cache: si pedian una pagina,
          // devolvemos el shell principal como respaldo
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
