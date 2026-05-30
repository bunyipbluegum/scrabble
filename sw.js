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

// ── CACHE: always fetch index.html from network, cache everything else ──
// This means new versions of index.html are always loaded immediately
const STATIC_CACHE = 'philaword-static-v1'; // only bump this for sw.js changes
const STATIC_ASSETS = ['/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Always fetch index.html fresh from network — never cache it
  if(url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // For static assets, use cache first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── PUSH NOTIFICATIONS ──
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
