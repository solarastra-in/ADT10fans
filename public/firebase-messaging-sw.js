// Firebase Cloud Messaging Service Worker for Abu Dhabi T10 Fan Hub
// Gives the app background push notification capabilities for Match Results and Contest Deadlines

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDdVkKyao9pB7w9euR5uL7P4SHrk7WzG_k",
  authDomain: "gen-lang-client-0433516004.firebaseapp.com",
  projectId: "gen-lang-client-0433516004",
  storageBucket: "gen-lang-client-0433516004.firebasestorage.app",
  messagingSenderId: "723963369160",
  appId: "1:723963369160:web:96ef6d195764643f44f7fd"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background push received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || '⚡ Abu Dhabi T10 Hub Alert';
  const body = payload.notification?.body || payload.data?.body || 'New live update from Abu Dhabi T10';
  const category = payload.data?.category || 'general';
  
  const options = {
    body,
    icon: payload.notification?.icon || '/assets/favicon.ico',
    badge: '/assets/favicon.ico',
    tag: payload.data?.notificationId || `adt10-${category}-${Date.now()}`,
    data: {
      ...payload.data,
      url: payload.data?.url || '/'
    },
    actions: [
      { action: 'open_app', title: 'Open Hub' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200],
    renotify: true
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
