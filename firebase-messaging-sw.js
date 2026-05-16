 // ═══════════════════════════════════════════════════════════════
//  ÉpicAlerte — firebase-messaging-sw.js
//  Service Worker FCM — doit être à la RACINE du projet
// ═══════════════════════════════════════════════════════════════

// Firebase 10 compat — version stable pour les Service Workers
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// ── Remplacez ces valeurs par les vôtres (mêmes que dans app.js) ──
const firebaseConfig = {
  apiKey: "AIzaSyDCvyJnMiF80IFE9IKQKyKOFoiCre3sQY8",
  authDomain: "projet-ecoaubaine.firebaseapp.com",
  databaseURL: "https://projet-ecoaubaine-default-rtdb.firebaseio.com",
  projectId: "projet-ecoaubaine",
  storageBucket: "projet-ecoaubaine.firebasestorage.app",
  messagingSenderId: "720715738287",
  appId: "1:720715738287:web:37c8b4eedde97b6593f85a",
  measurementId: "G-F7ZF6TJRRQ"
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