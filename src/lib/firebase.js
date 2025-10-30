// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- CONFIG WEB (corrigée) ---
const firebaseConfig = {
  apiKey: "AIzaSyCQxGJlYX-PHyX_QiLoVtYTlDiXln-9LaY",
  authDomain: "bloc-lego.firebaseapp.com",
  projectId: "bloc-lego",
  storageBucket: "bloc-lego.appspot.com", // ✅ correction ici
  messagingSenderId: "551752798435",
  appId: "1:551752798435:web:2848778b2bbe503b87b5d6",
  measurementId: "G-EP7LDMD2QB",
};

// Init (évite double init en HMR)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Exports principaux
export const auth = getAuth(app);
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
