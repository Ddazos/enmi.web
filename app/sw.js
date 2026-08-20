/* ============================================================
   SERVICE WORKER — Enmi
   ------------------------------------------------------------
   Estrategia: "primero la red" (network-first). Cada vez que
   alguien abre la app con conexión, se pide siempre la versión
   más reciente al servidor — la copia guardada en caché SOLO se
   usa como respaldo cuando no hay conexión de verdad.

   (Antes usábamos "primero la caché", que servía para siempre lo
   que ya tenía guardado sin comprobar si había algo nuevo — por
   eso las actualizaciones no llegaban a quien ya se había
   descargado la app antes. Con esta estrategia no vuelve a pasar.)

   Cuando cambies algo en index.html, sigue sin ser necesario tocar
   CACHE_VERSION a mano — pero si algún día quieres forzar que se
   limpie toda la caché vieja de golpe, súbelo igualmente.
============================================================ */
const CACHE_VERSION = 'enmi-v4';
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
  // Google Fonts, Firestore ni otras externas, esas se dejan pasar tal cual)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la red funciona, esa es siempre la respuesta que se usa
        // — y de paso actualizamos la copia guardada para la próxima
        // vez que no haya conexión.
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin conexión: aquí sí recurrimos a lo que tengamos guardado.
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

/* ============================================================
   NOTIFICACIONES — clic para abrir/enfocar la app
============================================================ */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./index.html');
      }
    })
  );
});

/* ============================================================
   FIREBASE CLOUD MESSAGING — avisos en segundo plano
============================================================ */
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB6ZxQC9aRL9-Q2HaVA9BJLO15Wsdejb6k",
  authDomain: "enmi-83eeb.firebaseapp.com",
  projectId: "enmi-83eeb",
  storageBucket: "enmi-83eeb.firebasestorage.app",
  messagingSenderId: "11076772193",
  appId: "1:11076772193:web:a86cc3abf65fdba4672520"
});

firebase.messaging();
