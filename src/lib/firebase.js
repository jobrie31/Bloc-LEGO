// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- CONFIG WEB (corrigée) ---
const firebaseConfig = {
  apiKey: "AIzaSyBYbBid4Cm4viZsQfX7uECAZkQu-SuIU24",
  authDomain: "inventaire-styro.firebaseapp.com",
  projectId: "inventaire-styro",
  storageBucket: "inventaire-styro.firebasestorage.app",
  messagingSenderId: "15818382324",
  appId: "1:15818382324:web:32d3558647b2c100bc37a1",
  measurementId: "G-8LCSLRKYHB",
};

// Init (évite double init en HMR)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Exports principaux
export const auth = getAuth(app);
auth.tenantId = "BLOC-LEGO-kg0q1";
export const db   = getFirestore(app);

// Connexion anonyme automatique (pour lier tes sauvegardes)
export async function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) await signInAnonymously(auth);
        resolve(auth.currentUser);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// --- Analytics (optionnel) : charge seulement si supporté (navigateur, https, etc.)
if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(async ({ getAnalytics, isSupported }) => {
      try {
        const ok = await isSupported();
        if (ok) getAnalytics(app);
      } catch (_) {
        /* ignore en dev si non supporté */
      }
    })
    .catch(() => {});
}
