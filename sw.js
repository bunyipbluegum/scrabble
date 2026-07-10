// Phils-a-Word SW v43 | 20260710
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBvEKWMCE5e5cYiibGIOHo9j2OjyXbKST0",
  authDomain: "scrabble-reilly.firebaseapp.com",
  projectId: "scrabble-reilly",
  messagingSenderId: "757650941656",
  appId: "1:757650941656:web:342f4634857efe3f4399ad"
});

const messaging = firebase.messaging();

// Never cache anything — always fetch fresh
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete ALL caches on activate
  e.waitUntil(
    caches.keys().then(keys => {
      console.log('SW: clearing caches:', keys);
      return Promise.all(keys.map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Always go to network — never serve from cache
  e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
});

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Phil-a-Word', {
    body: body || 'Tu turno',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: 'https://scr.reilly.mx' }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for(const client of list){
        if('focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow('https://scr.reilly.mx');
    })
  );
});