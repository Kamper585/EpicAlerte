// ═══════════════════════════════════════════════════════════════
//  ÉpicAlerte — app.js
// ═══════════════════════════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, deleteUser, onAuthStateChanged, signOut as fbSignOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs,
         deleteDoc, query, orderBy, limit, serverTimestamp, writeBatch }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";


// ── CONFIG — remplacez ces valeurs par les vôtres ──
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

const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
// Votre VAPID key — Firebase Console → Paramètres → Cloud Messaging → Web Push certificates
const VAPID_KEY = "BAhPN_gsaUX1In_1gcOrAonMmBocDsz3NjYsNN_VaD3Q0cSEAUcwZJPyAc6h5xshDtZGG3IwTNdon2cz18W40mo";


// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let currentUser  = null;
let userProducts = [];
let userStores   = [];
let alertHistory = [];
let todayAlerts  = 0;

const STORE_LIST = ['IGA', 'Provigo', 'Métro', 'Super C', 'Maxi', 'Walmart', 'Costco', 'Adonis'];


// ═══════════════════════════════════════════════════════════════
//  PAGE / HEADER VISIBILITY
//  CORRECTION : inclut 'loading' dans la liste des pages
// ═══════════════════════════════════════════════════════════════
function showPage(page) {
  ['loading', 'landing', 'onboarding', 'app'].forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== page);
  });
}

function showHeader(mode) {
  document.getElementById('header-public').classList.toggle('hidden',  mode !== 'public');
  document.getElementById('header-private').classList.toggle('hidden', mode !== 'private');
}

// Affiche le spinner immédiatement, avant que Firebase réponde
showPage('loading');
showHeader('public');


// ═══════════════════════════════════════════════════════════════
//  AUTH STATE LISTENER
//  CORRECTION : try/catch + écran de chargement
// ═══════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showHeader('private');
    document.getElementById('user-avatar').textContent        = user.email[0].toUpperCase();
    document.getElementById('user-email-display').textContent = user.email;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || !(userDoc.data().stores?.length)) {
        showPage('onboarding');
        renderStoreGrid('onboarding-stores', []);
      } else {
        userStores = userDoc.data().stores || [];
        await loadUserData();
        showPage('app');
        renderApp();
      }
    } catch(e) {
      console.error('[Auth] Erreur chargement:', e);
      if (e.message?.includes('offline') || e.code === 'unavailable') {
        toast('Firestore hors ligne — vérifiez que votre domaine est autorisé dans Firebase Auth → Settings → Authorized domains.', 'error');
      } else {
        toast('Erreur : ' + e.message, 'error');
      }
      // Ne pas déconnecter — laisser l'utilisateur réessayer
      showPage('landing');
      showHeader('private');
    }
  } else {
    currentUser = null;
    userProducts = []; userStores = []; alertHistory = []; todayAlerts = 0;
    showHeader('public');
    showPage('landing');
  }
});


// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════
function openModal(tab) {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchTab(tab || 'login');
}
function closeModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-signup').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}


// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-submit-btn');
  errEl.classList.add('hidden');
  if (!email || !pass) { showErr(errEl, 'Veuillez remplir tous les champs.'); return; }
  btn.innerHTML = '<span class="loader"></span>'; btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal();
  } catch(e) {
    showErr(errEl, fbErr(e.code));
  } finally {
    btn.innerHTML = 'Se connecter'; btn.disabled = false;
  }
}

async function doSignup() {
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  const btn   = document.getElementById('signup-submit-btn');
  errEl.classList.add('hidden');
  if (!email || !pass) { showErr(errEl, 'Veuillez remplir tous les champs.'); return; }
  if (pass.length < 6)  { showErr(errEl, 'Le mot de passe doit contenir au moins 6 caractères.'); return; }
  btn.innerHTML = '<span class="loader"></span>'; btn.disabled = true;
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    closeModal();
  } catch(e) {
    showErr(errEl, fbErr(e.code));
  } finally {
    btn.innerHTML = 'Créer mon compte'; btn.disabled = false;
  }
}

async function doForgotPw() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { toast('Entrez votre adresse courriel d\'abord.', 'error'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Email de réinitialisation envoyé !', 'success');
  } catch(e) { toast(fbErr(e.code), 'error'); }
}

async function doSignOut() {
  await fbSignOut(auth);
  toast('Déconnecté.', 'info');
}

async function doDeleteAccount() {
  if (!confirm('Êtes-vous certain ? Cette action est IRRÉVERSIBLE.')) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', currentUser.uid));
    (await getDocs(collection(db, 'users', currentUser.uid, 'products'))).forEach(d => batch.delete(d.ref));
    (await getDocs(collection(db, 'users', currentUser.uid, 'alerts'))).forEach(d => batch.delete(d.ref));
    await batch.commit();
    await deleteUser(currentUser);
    toast('Compte supprimé.', 'info');
  } catch(e) {
    toast('Erreur : reconnectez-vous puis réessayez.', 'error');
  }
}


// ═══════════════════════════════════════════════════════════════
//  STORE GRID
// ═══════════════════════════════════════════════════════════════
function renderStoreGrid(containerId, selected) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = STORE_LIST.map(s =>
    `<div class="store-toggle${selected.includes(s) ? ' selected' : ''}" data-store="${s}">${s}</div>`
  ).join('');
}


// ═══════════════════════════════════════════════════════════════
//  ONBOARDING
//  CORRECTION : try/catch + loader + vérification Firestore
// ═══════════════════════════════════════════════════════════════
async function saveOnboarding() {
  const sel    = [...document.querySelectorAll('#onboarding-stores .store-toggle.selected')].map(e => e.dataset.store);
  const custom = document.getElementById('custom-store').value.trim();
  if (custom) sel.push(...custom.split(',').map(s => s.trim()).filter(Boolean));
  if (!sel.length) { toast('Choisissez au moins un magasin.', 'error'); return; }

  const btn = document.getElementById('btn-save-onboarding');
  btn.innerHTML = '<span class="loader"></span> Sauvegarde...';
  btn.disabled  = true;

  try {
    await setDoc(doc(db, 'users', currentUser.uid), {
      stores: sel,
      email:  currentUser.email
    }, { merge: true });

    // Relire depuis Firestore pour confirmer la persistance
    const verify = await getDoc(doc(db, 'users', currentUser.uid));
    userStores = verify.data()?.stores || sel;

    // Remettre le bouton AVANT de changer de page
    btn.innerHTML = '<i class="fas fa-check"></i> Confirmer mes magasins';
    btn.disabled  = false;

    await loadUserData();
    showPage('app');
    renderApp();
    toast(`✅ ${userStores.length} magasin(s) sauvegardé(s) !`, 'success');
  } catch(e) {
    console.error('[saveOnboarding]', e);
    const msg = e.message?.includes('offline')
      ? 'Firestore hors ligne — vérifiez les domaines autorisés dans Firebase Auth.'
      : 'Erreur de sauvegarde : ' + e.message;
    toast(msg, 'error');
    btn.innerHTML = '<i class="fas fa-check"></i> Confirmer mes magasins';
    btn.disabled  = false;
  }
}


// ═══════════════════════════════════════════════════════════════
//  PARAMÈTRES — sauvegarder les magasins
//  CORRECTION : try/catch + loader + vérification Firestore
// ═══════════════════════════════════════════════════════════════
async function saveStoreSettings() {
  const sel    = [...document.querySelectorAll('#settings-stores .store-toggle.selected')].map(e => e.dataset.store);
  const custom = document.getElementById('settings-custom-store').value.trim();
  if (custom) sel.push(...custom.split(',').map(s => s.trim()).filter(Boolean));
  if (!sel.length) { toast('Choisissez au moins un magasin.', 'error'); return; }

  const btn = document.getElementById('btn-save-stores');
  btn.innerHTML = '<span class="loader"></span> Sauvegarde...';
  btn.disabled  = true;

  try {
    await setDoc(doc(db, 'users', currentUser.uid), { stores: sel }, { merge: true });

    // Relire depuis Firestore pour confirmer la persistance
    const verify = await getDoc(doc(db, 'users', currentUser.uid));
    userStores = verify.data()?.stores || sel;

    updateStats();
    renderSettings();
    toast(`✅ ${userStores.length} magasin(s) sauvegardé(s) !`, 'success');
  } catch(e) {
    console.error('[saveStoreSettings]', e);
    const msg = e.message?.includes('offline')
      ? 'Firestore hors ligne — vérifiez les domaines autorisés dans Firebase Auth.'
      : 'Erreur de sauvegarde : ' + e.message;
    toast(msg, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
    btn.disabled  = false;
  }
}


// ═══════════════════════════════════════════════════════════════
//  DATA — chargement depuis Firestore
//  CORRECTION : try/catch séparés pour produits et alertes
// ═══════════════════════════════════════════════════════════════
async function loadUserData() {
  try {
    userProducts = [];
    const prodsSnap = await getDocs(collection(db, 'users', currentUser.uid, 'products'));
    prodsSnap.forEach(d => userProducts.push({ id: d.id, ...d.data(), onSale: false }));
  } catch(e) {
    console.error('[loadUserData] produits:', e);
    toast('Erreur de chargement des produits.', 'error');
  }

  try {
    alertHistory = [];
    const alertsSnap = await getDocs(query(
      collection(db, 'users', currentUser.uid, 'alerts'),
      orderBy('date', 'desc'),
      limit(50)
    ));
    alertsSnap.forEach(d => alertHistory.push({ id: d.id, ...d.data() }));
  } catch(e) {
    console.error('[loadUserData] alertes:', e);
    // Les alertes sont optionnelles, on ne bloque pas l'app
  }
}


// ═══════════════════════════════════════════════════════════════
//  PRODUITS
// ═══════════════════════════════════════════════════════════════
async function addProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const thr  = parseFloat(document.getElementById('prod-threshold').value);
  if (!name)               { toast('Entrez le nom du produit.', 'error'); return; }
  if (isNaN(thr) || thr <= 0) { toast('Entrez un prix seuil valide.', 'error'); return; }
  if (!currentUser)        { toast('Vous devez être connecté.', 'error'); return; }

  const btn = document.getElementById('btn-add-product');
  btn.innerHTML = '<span class="loader"></span>'; btn.disabled = true;

  try {
    const ref = await addDoc(
      collection(db, 'users', currentUser.uid, 'products'),
      { name, threshold: thr }
    );
    userProducts.push({ id: ref.id, name, threshold: thr, onSale: false });
    document.getElementById('prod-name').value      = '';
    document.getElementById('prod-threshold').value = '';
    renderProducts();
    updateStats();
    toast(`✅ "${name}" ajouté !`, 'success');
  } catch(e) {
    console.error('[addProduct]', e);
    toast('Erreur : ' + e.message, 'error');
    document.getElementById('firestore-warning').classList.remove('hidden');
  } finally {
    btn.innerHTML = '<i class="fas fa-plus"></i> Ajouter'; btn.disabled = false;
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Supprimer "${name}" ?`)) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'products', id));
    userProducts = userProducts.filter(p => p.id !== id);
    renderProducts();
    updateStats();
    toast(`"${name}" supprimé.`, 'info');
  } catch(e) {
    console.error('[deleteProduct]', e);
    toast('Erreur : ' + e.message, 'error');
  }
}

function renderProducts() {
  const el = document.getElementById('products-list');
  if (!el) return;
  if (!userProducts.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>Aucun produit dans votre liste.<br/>Ajoutez-en un ci-dessus !</p></div>`;
    return;
  }
  el.innerHTML = userProducts.map(p => `
    <div class="product-card${p.onSale ? ' on-sale' : ''}">
      <div class="product-info">
        <div class="product-name">
          ${p.name}
          ${p.onSale ? '<span class="badge badge-green">🏷️ En spécial aujourd\'hui !</span>' : ''}
        </div>
        <div class="product-threshold">Seuil : <strong>${p.threshold.toFixed(2)} $</strong></div>
      </div>
      <div class="product-price${p.onSale ? ' deal' : ''}">
        ${p.currentPrice
          ? `<div class="current">${p.currentPrice.toFixed(2)} $</div><div class="store">chez ${p.currentStore}</div>`
          : `<div class="current" style="color:var(--text-mute);font-size:.82rem">Aucun spécial récent</div>`}
      </div>
      <button class="delete-btn" data-del-id="${p.id}" data-del-name="${p.name}">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}


// ═══════════════════════════════════════════════════════════════
//  SIMULATION
// ═══════════════════════════════════════════════════════════════
async function simulateDay() {
  if (!userProducts.length) { toast('Ajoutez des produits d\'abord !', 'error'); return; }
  if (!userStores.length)   { toast('Configurez vos magasins d\'abord.', 'error'); return; }

  userProducts.forEach(p => { p.onSale = false; p.currentPrice = null; p.currentStore = null; });

  const count  = 2 + Math.floor(Math.random() * 3);
  const picked = [...userProducts].sort(() => Math.random() - .5).slice(0, Math.min(count, userProducts.length));
  const newAlerts = [];

  for (const prod of picked) {
    const pool  = [...new Set([...userStores, 'Loblaw', 'Costco', 'Walmart'])];
    const store = pool[Math.floor(Math.random() * pool.length)];
    if (!userStores.includes(store)) continue;

    const price = parseFloat((prod.threshold * 0.6 + Math.random() * prod.threshold * 0.6).toFixed(2));
    prod.currentPrice = price;
    prod.currentStore = store;

    if (price <= prod.threshold) {
      prod.onSale = true;
      const alertData = {
        product: prod.name, price, store,
        threshold: prod.threshold,
        date: new Date().toISOString()
      };
      newAlerts.push(alertData);
      alertHistory.unshift({ ...alertData, id: Date.now() + Math.random() });

      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'alerts'), {
          ...alertData, date: serverTimestamp()
        });
      } catch(e) {
        console.error('[simulateDay] alerte:', e);
      }

      // PUSH INTEGRATION — remplacez par OneSignal ou FCM
      console.log(`[PUSH] "${prod.name}" à ${price}$ chez ${store}`);

      if (Notification.permission === 'granted') {
        new Notification(`🏷️ ${prod.name} en spécial !`, {
          body: `${price.toFixed(2)}$ chez ${store} (seuil : ${prod.threshold.toFixed(2)}$)`
        });
      }
    }
  }

  todayAlerts = newAlerts.length;
  renderProducts();
  renderDashboardAlerts();
  renderHistory();
  updateStats();

  toast(
    newAlerts.length
      ? `🎉 ${newAlerts.length} spécial${newAlerts.length > 1 ? 'x' : ''} trouvé${newAlerts.length > 1 ? 's' : ''} !`
      : 'Aucun spécial sous votre seuil aujourd\'hui.',
    newAlerts.length ? 'success' : 'info'
  );
}


// ═══════════════════════════════════════════════════════════════
//  RENDERS
// ═══════════════════════════════════════════════════════════════
function renderDashboardAlerts() {
  const el     = document.getElementById('dashboard-alerts');
  if (!el) return;
  const recent = alertHistory.slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Aucun spécial détecté.<br/>Cliquez sur "Simuler un nouveau jour" pour tester.</p></div>`;
    return;
  }
  el.innerHTML = recent.map(a => `
    <div class="alert-item">
      <div class="alert-icon"><i class="fas fa-tag"></i></div>
      <div class="alert-body">
        <div class="alert-title">${a.product}</div>
        <div class="alert-sub">chez ${a.store} · ${fmtDate(a.date)}</div>
      </div>
      <div class="alert-price">${a.price.toFixed(2)} $</div>
      <span class="badge badge-green">Alerte</span>
    </div>
  `).join('');
}

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  if (!alertHistory.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>Aucun historique pour l'instant.</p></div>`;
    document.getElementById('alerts-badge').style.display = 'none';
    return;
  }
  el.innerHTML = alertHistory.map(a => `
    <div class="history-item">
      <span class="history-date">${fmtDate(a.date)}</span>
      <div class="alert-icon" style="width:32px;height:32px;border-radius:50%;background:rgba(34,197,94,.1);color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-tag" style="font-size:.75rem"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:.88rem">${a.product} à ${a.price.toFixed(2)} $ chez ${a.store}</div>
        <div style="font-size:.78rem;color:var(--text-mute)">Seuil : ${a.threshold ? a.threshold.toFixed(2) + ' $' : '—'}</div>
      </div>
      <span class="badge badge-gold">-${a.threshold ? Math.round((1 - a.price / a.threshold) * 100) : 0}%</span>
    </div>
  `).join('');

  const badge = document.getElementById('alerts-badge');
  badge.textContent   = alertHistory.length > 9 ? '9+' : alertHistory.length;
  badge.style.display = '';
}

async function clearAlerts() {
  if (!confirm('Effacer tout l\'historique des alertes ?')) return;
  try {
    const batch = writeBatch(db);
    (await getDocs(collection(db, 'users', currentUser.uid, 'alerts'))).forEach(d => batch.delete(d.ref));
    await batch.commit();
    alertHistory = []; todayAlerts = 0;
    renderHistory(); renderDashboardAlerts(); updateStats();
    toast('Historique effacé.', 'info');
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
}


// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
async function requestNotif() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && !window.navigator.standalone) {
    document.getElementById('ios-notice').classList.remove('hidden');
    toast("Ajoutez d'abord l'app à l'écran d'accueil via Safari !", 'info');
    return;
  }
  if (!('Notification' in window)) {
    toast('Ce navigateur ne supporte pas les notifications.', 'error');
    return;
  }

  const btn = document.getElementById('notif-btn');
  btn.innerHTML = '<span class="loader"></span> Activation...';
  btn.disabled  = true;

  try {
    // 1. Enregistrer le Service Worker FCM
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM] Service Worker enregistré:', swReg);

    // 2. Demander la permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      toast('Permission refusée. Vérifiez les paramètres de votre navigateur.', 'error');
      btn.innerHTML = '<i class="fas fa-bell"></i> Activer les alertes mobiles';
      btn.disabled  = false;
      return;
    }

    // 3. Importer et initialiser Firebase Messaging de façon lazy
    const { getMessaging, getToken, onMessage } = await import(
      "https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging.js"
    );
    const messaging = getMessaging(app);
    console.log('[FCM] Messaging initialisé');

    // 4. Obtenir le token FCM
    const token = await getToken(messaging, {
      vapidKey:                  VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      toast("Impossible d'obtenir le token FCM. Réessayez.", 'error');
      btn.innerHTML = '<i class="fas fa-bell"></i> Activer les alertes mobiles';
      btn.disabled  = false;
      return;
    }

    console.log('[FCM] Token obtenu:', token);

    // 5. Sauvegarder le token dans Firestore
    await setDoc(doc(db, 'users', currentUser.uid), { fcmToken: token }, { merge: true });
    console.log('[FCM] Token sauvegardé dans Firestore');

    btn.innerHTML     = '<i class="fas fa-check"></i> Alertes activées !';
    btn.disabled      = true;
    btn.style.opacity = '.7';
    toast("Notifications activées ! Vous recevrez les alertes meme quand l'app est fermee.", 'success');

    // 6. Ecouter les messages quand l'app est au premier plan
    onMessage(messaging, (payload) => {
      console.log('[FCM] Message recu au premier plan:', payload);
      toast('🏷️ ' + (payload.notification?.title || 'Nouveau special !'), 'success');
    });

  } catch(e) {
    console.error('[FCM] Erreur:', e);
    toast("Erreur d'activation : " + e.message, 'error');
    btn.innerHTML = '<i class="fas fa-bell"></i> Activer les alertes mobiles';
    btn.disabled  = false;
  }
}


// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function showScreen(name) {
  showPage('app');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-screen="${name}"]`)?.classList.add('active');
  if (name === 'settings') renderSettings();
  if (name === 'products') renderProducts();
}


// ═══════════════════════════════════════════════════════════════
//  PARAMÈTRES — render
// ═══════════════════════════════════════════════════════════════
function renderSettings() {
  renderStoreGrid('settings-stores', userStores);
  const customs = userStores.filter(s => !STORE_LIST.includes(s));
  document.getElementById('settings-custom-store').value = customs.join(', ');
  document.getElementById('settings-email').textContent  = currentUser?.email || '—';
}


// ═══════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════
function updateStats() {
  document.getElementById('stat-products').textContent = userProducts.length;
  document.getElementById('stat-today').textContent    = todayAlerts;
  document.getElementById('stat-stores').textContent   = userStores.length;
  document.getElementById('stat-total').textContent    = alertHistory.length;
}

function renderApp() {
  renderProducts();
  renderDashboardAlerts();
  renderHistory();
  renderSettings();
  updateStats();
  checkNotifStatus();
}

// Vérifie si les notifications sont déjà activées pour cet utilisateur
async function checkNotifStatus() {
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists() && userDoc.data().fcmToken) {
      const btn = document.getElementById('notif-btn');
      if (btn) {
        btn.innerHTML      = '<i class="fas fa-check"></i> Alertes activées !';
        btn.disabled       = true;
        btn.style.opacity  = '.7';
      }
    }
  } catch(e) {
    console.log('[FCM] Vérification statut notifications:', e.message);
  }
}


// ═══════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════
function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i>${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

function fmtDate(d) {
  try {
    const dt = typeof d === 'string' ? new Date(d) : d?.toDate?.() || new Date();
    return dt.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function fbErr(code) {
  const map = {
    'auth/email-already-in-use':  'Cette adresse courriel est déjà utilisée.',
    'auth/invalid-email':          'Adresse courriel invalide.',
    'auth/weak-password':          'Mot de passe trop faible (min. 6 caractères).',
    'auth/user-not-found':         'Aucun compte associé à cet email.',
    'auth/wrong-password':         'Mot de passe incorrect.',
    'auth/invalid-credential':     'Email ou mot de passe incorrect.',
    'auth/too-many-requests':      'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
  };
  return map[code] || `Erreur : ${code}`;
}


// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

document.getElementById('footer-year').textContent = new Date().getFullYear();

// Lien Contact du footer — ancre vers #section-contact (pas de JS nécessaire)

// Conditions d'utilisation
document.getElementById('terms-link').addEventListener('click', e => {
  e.preventDefault();
  // Mettre la date du jour
  document.getElementById('terms-date').textContent = new Date().toLocaleDateString('fr-CA', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('terms-modal').classList.remove('hidden');
});
document.getElementById('terms-close-btn').addEventListener('click', () => {
  document.getElementById('terms-modal').classList.add('hidden');
});
document.getElementById('terms-accept-btn').addEventListener('click', () => {
  document.getElementById('terms-modal').classList.add('hidden');
});
document.getElementById('terms-modal').addEventListener('click', e => {
  if (e.target.id === 'terms-modal') document.getElementById('terms-modal').classList.add('hidden');
});

// Modal
document.getElementById('btn-open-login').addEventListener('click',    () => openModal('login'));
document.getElementById('btn-open-signup').addEventListener('click',   () => openModal('signup'));
document.getElementById('cta-signup-hero').addEventListener('click',   () => openModal('signup'));
document.getElementById('cta-login-hero').addEventListener('click',    () => openModal('login'));
document.getElementById('cta-signup-bottom').addEventListener('click', () => openModal('signup'));
document.getElementById('modal-close-btn').addEventListener('click',   closeModal);
document.getElementById('auth-modal').addEventListener('click', e => {
  if (e.target.id === 'auth-modal') closeModal();
});
document.getElementById('tab-login').addEventListener('click',  () => switchTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => switchTab('signup'));
document.getElementById('logo-link').addEventListener('click', e => {
  e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Auth
document.getElementById('login-submit-btn').addEventListener('click',  doLogin);
document.getElementById('signup-submit-btn').addEventListener('click', doSignup);
document.getElementById('forgot-pw-link').addEventListener('click',    doForgotPw);
document.getElementById('login-password').addEventListener('keydown',  e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('signup-password').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });

// Header privé
document.getElementById('btn-signout').addEventListener('click',         doSignOut);
document.getElementById('btn-settings-header').addEventListener('click', () => showScreen('settings'));

// Sidebar
document.querySelectorAll('.nav-item[data-screen]').forEach(btn =>
  btn.addEventListener('click', () => showScreen(btn.dataset.screen))
);

// Dashboard
document.getElementById('btn-simulate').addEventListener('click', simulateDay);

// Produits
document.getElementById('btn-add-product').addEventListener('click', addProduct);
document.getElementById('prod-name').addEventListener('keydown', e => { if (e.key === 'Enter') addProduct(); });
document.getElementById('products-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-del-id]');
  if (btn) deleteProduct(btn.dataset.delId, btn.dataset.delName);
});

// Historique
document.getElementById('btn-clear-alerts').addEventListener('click', clearAlerts);

// Notifications
document.getElementById('notif-btn').addEventListener('click', requestNotif);

// Paramètres
document.getElementById('btn-save-stores').addEventListener('click',      saveStoreSettings);
document.getElementById('btn-signout-settings').addEventListener('click', doSignOut);
document.getElementById('btn-delete-account').addEventListener('click',   doDeleteAccount);

// Onboarding
document.getElementById('btn-save-onboarding').addEventListener('click', saveOnboarding);

// Store toggles — délégation globale
document.addEventListener('click', e => {
  const toggle = e.target.closest('.store-toggle');
  if (toggle) toggle.classList.toggle('selected');
});

// Contact
document.getElementById('btn-send-contact').addEventListener('click', sendContactMessage);

async function sendContactMessage() {
  const subject = document.getElementById('contact-subject').value;
  const message = document.getElementById('contact-message').value.trim();
  const errEl   = document.getElementById('contact-error');
  const succEl  = document.getElementById('contact-success');
  const btn     = document.getElementById('btn-send-contact');

  errEl.classList.add('hidden');
  succEl.classList.add('hidden');

  if (!subject) { errEl.textContent = 'Choisissez un sujet.'; errEl.classList.remove('hidden'); return; }
  if (!message || message.length < 10) { errEl.textContent = 'Votre message doit contenir au moins 10 caractères.'; errEl.classList.remove('hidden'); return; }

  btn.innerHTML = '<span class="loader"></span> Envoi...'; btn.disabled = true;

  try {
    await addDoc(collection(db, 'messages'), {
      userId:    currentUser.uid,
      email:     currentUser.email,
      subject,
      message,
      date:      serverTimestamp(),
      read:      false
    });

    document.getElementById('contact-subject').value  = '';
    document.getElementById('contact-message').value  = '';
    succEl.classList.remove('hidden');
  } catch(e) {
    console.error('[Contact]', e);
    errEl.textContent = "Erreur lors de l'envoi. Réessayez.";
    errEl.classList.remove('hidden');
  } finally {
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le message';
    btn.disabled  = false;
  }
}
