 // ═══════════════════════════════════════════════════════════════
//  ÉpicAlerte — firebase-messaging-sw.js
//  Service Worker FCM — doit être à la RACINE du projet
// ═══════════════════════════════════════════════════════════════

// Firebase 10 compat — version stable pour les Service Workers
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// ── Remplacez ces valeurs par les vôtres (mêmes que dans app.js) ──
const firebaseConfig = {
  apiKey: "AIzaSyAIvFi-fcZ3iwwCKm0neN4jCzd4EMfOPdc",
  authDomain: "authentication-dd396.firebaseapp.com",
  projectId: "authentication-dd396",
  storageBucket: "authentication-dd396.firebasestorage.app",
  messagingSenderId: "360794880737",
  appId: "1:360794880737:web:592f13790e0e318f8695a0",
  measurementId: "G-VN39DL2N9V"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Notification reçue quand l'app est en arrière-plan ou fermée
messaging.onBackgroundMessage(function(payload) {
  console.log("[FCM SW] Message reçu en arrière-plan:", payload);

  var title = (payload.notification && payload.notification.title) || "EpicAlerte";
  var body  = (payload.notification && payload.notification.body)  || "Un nouveau special vous attend !";

  self.registration.showNotification(title, {
    body:    body,
    icon:    "/icon-192.png",
    vibrate: [200, 100, 200],
    data:    { url: "/" }
  });
});

// Clic sur la notification - ouvre l'app
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url === "/" && "focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});