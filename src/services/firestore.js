// src/services/firestore.js
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  // ↓ ajoutés pour Trajets
  getDocs,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

/* ---------- Helpers ---------- */
const numOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utilisateur non connecté.");
  return uid;
}

/* ---------- Refs ---------- */
function appDocRef(uid) {
  // Document unique par utilisateur pour stocker vans/moulures
  return doc(db, "users", uid, "app", "v1"); // { vans:[], moulures:[] }
}
function runsColRef(uid) {
  return collection(db, "users", uid, "runs"); // logs par utilisateur
}

// === Trajets partagés (collection commune)
const trajetsSharedCol = collection(db, "trajets");

/* =========================================================
 * VANS (users/{uid}/app/v1.vans)
 * ======================================================= */
export async function loadVans() {
  const uid = requireUid();
  const snap = await getDoc(appDocRef(uid));
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const list = Array.isArray(data.vans) ? data.vans : [];
  return list.map((v) => ({
    name: String(v?.name ?? ""),
    group: String(v?.group ?? ""),
    l: v?.l ?? null,
    w: v?.w ?? null,
    h: v?.h ?? null,
    cost: v?.cost ?? null,
    maxW: v?.maxW ?? null,
    enabled: v?.enabled !== false, // défaut: true
  }));
}

export async function saveVans(vansArray) {
  const uid = requireUid();
  const list = (Array.isArray(vansArray) ? vansArray : []).map((v) => ({
    name: String(v?.name ?? ""),
    group: String(v?.group ?? "").trim(),
    l: numOrNull(v?.l),
    w: numOrNull(v?.w),
    h: numOrNull(v?.h),
    cost: numOrNull(v?.cost),
    maxW: numOrNull(v?.maxW),
    enabled: v?.enabled !== false, // on persiste le flag
  }));
  await setDoc(
    appDocRef(uid),
    { vans: list, updatedAt: serverTimestamp(), uid },
    { merge: true }
  );
}

/* =========================================================
 * MOULURES (users/{uid}/app/v1.moulures)
 * ======================================================= */
export async function loadMoulures() {
  const uid = requireUid();
  const snap = await getDoc(appDocRef(uid));
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const rows = Array.isArray(data.moulures) ? data.moulures : [];
  return rows.map((r) => ({
    id: String(r?.id ?? ""),
    l: r?.l ?? null,
    h: r?.h ?? null,
    wt: r?.wt ?? null,
  }));
}

export async function saveMoulures(rows) {
  const uid = requireUid();
  const out = (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r?.id ?? ""),
    l: numOrNull(r?.l),
    h: numOrNull(r?.h),
    wt: numOrNull(r?.wt),
  }));
  await setDoc(
    appDocRef(uid),
    { moulures: out, updatedAt: serverTimestamp(), uid },
    { merge: true }
  );
}

/* =========================================================
 * RUNS (users/{uid}/runs/*)
 * ======================================================= */
export async function saveRun(resultPayload) {
  const uid = requireUid();
  const ref = await addDoc(runsColRef(uid), {
    createdAt: serverTimestamp(),
    uid,
    payload: resultPayload,
  });
  return ref.id;
}

/* =========================================================
 * TRAJETS (partagés: /trajets/*)
 *  - saveTrajet(payload, user)
 *  - subscribeTrajets(cb)  [temps réel]
 *  - loadTrajets()         [chargement ponctuel]
 *  - deleteTrajet(id)
 * ======================================================= */

/**
 * Enregistre un trajet partagé (résultat courant + contexte).
 * payload attendu:
 * {
 *   title, notes,
 *   context: { userEmail, vansSnapshot:[...], rowsSnapshot:[...] },
 *   result:  { stats:{...}, vans:[...], billing:{...}, costBreakdown:[...] }
 * }
 */
export async function saveTrajet(payload, user) {
  const docData = {
    title: String(payload?.title || "").trim(),
    notes: String(payload?.notes || "").trim(),
    context: payload?.context || {},
    result: payload?.result || {},
    author: {
      uid: user?.uid || "",
      email: user?.email || "",
      displayName: user?.displayName || "",
    },
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(trajetsSharedCol, docData);
  return ref.id;
}

/** Abonnement temps réel à tous les trajets (ordre desc par date) */
export function subscribeTrajets(callback) {
  const q = query(trajetsSharedCol, orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() || {}) }));
    callback(out);
  });
  return unsub;
}

/** Chargement ponctuel (si tu veux juste fetch une fois) */
export async function loadTrajets() {
  const q = query(trajetsSharedCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const out = [];
  snap.forEach((docSnap) => {
    out.push({ id: docSnap.id, ...(docSnap.data() || {}) });
  });
  return out;
}

export async function deleteTrajet(trajetId) {
  if (!trajetId) throw new Error("trajectId manquant.");
  const ref = doc(db, "trajets", trajetId);
  await deleteDoc(ref);
}
