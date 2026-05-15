 // ═══════════════════════════════════════════════════════════════
//  ÉpicAlerte — firebase-messaging-sw.js
//  Service Worker FCM — doit être à la RACINE du projet
//  Ce fichier gère les notifications quand l'app est fermée
// ═══════════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

// ── Même config que dans app.js ──
const firebaseConfig = {
  apiKey: "AIzaSyAIvFi-fcZ3iwwCKm0neN4jCzd4EMfOPdc",
  authDomain: "authentication-dd396.firebaseapp.com",
  projectId: "authentication-dd396",
  storageBucket: "authentication-dd396.firebasestorage.app",
  messagingSenderId: "360794880737",
  appId: "1:360794880737:web:592f13790e0e318f8695a0",
  measurementId: "G-VN39DL2N9V"
};

const messaging = firebase.messaging();

// Notification reçue quand l'app est en arrière-plan ou fermée
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message reçu en arrière-plan:", payload);

  const { title, body } = payload.notification || {};

  self.registration.showNotification(title || "ÉpicAlerte 🛒", {
    body:    body || "Un nouveau spécial vous attend !",
    icon:    "/icon-192.png",
    badge:   "/icon-192.png",
    vibrate: [200, 100, 200],
    data:    { url: "/" },
  });
});

// Clic sur la notification → ouvre l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});