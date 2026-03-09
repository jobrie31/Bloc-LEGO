// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyANkJRYoCA1e2CsCoFslfnKJzgV-KlRHn8",
  authDomain: "planification-styro.firebaseapp.com",
  projectId: "planification-styro",
  storageBucket: "planification-styro.firebasestorage.app",
  messagingSenderId: "387018358469",
  appId: "1:387018358469:web:bf4436c734a15f69c3aac",
};

// Évite double init en dev / HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exports principaux
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

// Analytics optionnel
if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(async ({ getAnalytics, isSupported }) => {
      try {
        const ok = await isSupported();
        if (ok) getAnalytics(app);
      } catch (_) {
        // ignore
      }
    })
    .catch(() => {});
}