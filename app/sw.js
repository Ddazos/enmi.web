/* ============================================================
   SERVICE WORKER — Enmi
   Estrategia: cache-first para el "app shell" (todo vive en un
   único HTML autocontenido, así que cachear ese archivo ya
   cubre toda la app funcionando offline).

   Cuando cambies algo en index.html, sube el numero de CACHE_VERSION
   para forzar a los usuarios a descargar la version nueva.
============================================================ */
const CACHE_VERSION = 'enmi-v3';
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
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
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
   ------------------------------------------------------------
   Esto se encarga de mostrar la notificación cuando llega desde
   el servidor (la Cloud Function) y la app no está abierta en
   ese momento. Usamos el SDK "compat" aquí porque los Service
   Workers no soportan de forma sencilla el SDK modular con
   importScripts.
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

// No hace falta definir onBackgroundMessage a mano: como la Cloud
// Function manda el aviso con un campo "notification" (no solo
// "data"), Firebase lo muestra automáticamente usando el icono y
// el título/cuerpo que le pasamos desde el servidor.
firebase.messaging();
