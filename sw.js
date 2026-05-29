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

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Scrabble', {
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
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('https://scr.reilly.mx');
    })
  );
});