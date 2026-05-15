 // ═══════════════════════════════════════════════════════════════
//  ÉpicAlerte — functions/index.js
//  Firebase Cloud Functions pour les notifications push FCM
// ═══════════════════════════════════════════════════════════════

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore }      = require("firebase-admin/firestore");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

// ═══════════════════════════════════════════════════════════════
//  DÉCLENCHEUR : nouveau document dans /users/{uid}/alerts/{alertId}
//  S'exécute automatiquement quand simulateDay() crée une alerte
// ═══════════════════════════════════════════════════════════════
exports.sendPushOnAlert = onDocumentCreated(
  "users/{userId}/alerts/{alertId}",
  async (event) => {
    const alert  = event.data.data();
    const userId = event.params.userId;

    if (!alert) {
      console.log("Alerte vide, on skip.");
      return;
    }

    const db = getFirestore();

    // Récupérer le token FCM de l'utilisateur
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`Utilisateur ${userId} introuvable.`);
      return;
    }

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) {
      console.log(`Pas de token FCM pour ${userId} — notifications non activées.`);
      return;
    }

    // Vérifier que le prix est bien sous le seuil
    if (alert.price > alert.threshold) {
      console.log(`Prix ${alert.price} > seuil ${alert.threshold}, pas de notification.`);
      return;
    }

    // Construire le message push
    const message = {
      token: fcmToken,
      notification: {
        title: `🏷️ ${alert.product} en spécial !`,
        body:  `${alert.price.toFixed(2)}$ chez ${alert.store} (votre seuil : ${alert.threshold.toFixed(2)}$)`,
      },
      webpush: {
        notification: {
          icon:  "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: "/",
        },
      },
    };

    try {
      const response = await getMessaging().send(message);
      console.log(`✅ Notification envoyée à ${userId} : ${response}`);
    } catch (error) {
      // Token invalide ou expiré — on le supprime de Firestore
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        console.log(`Token FCM invalide pour ${userId}, suppression.`);
        await db.collection("users").doc(userId).update({ fcmToken: null });
      } else {
        console.error(`Erreur envoi notification : ${error.message}`);
      }
    }
  }
);