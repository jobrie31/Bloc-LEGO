// src/services/firestore.js
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
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
function userRootRef(uid) {
  return doc(db, "clients", "bloc-lego", "users", uid);
}

function appDocRef(uid) {
  return doc(db, "clients", "bloc-lego", "users", uid, "app", "v1");
}

function runsColRef(uid) {
  return collection(db, "clients", "bloc-lego", "users", uid, "runs");
}

// anciens chemins (pour migration seulement)
function oldAppDocRef(uid) {
  return doc(db, "users", uid, "app", "v1");
}

function oldRunsColRef(uid) {
  return collection(db, "users", uid, "runs");
}

// === Trajets partagés
const trajetsSharedCol = collection(db, "clients", "bloc-lego", "trajets");

/* ---------- Création du parent users/{uid} ---------- */
async function ensureUserRoot(uid, extra = {}) {
  await setDoc(
    userRootRef(uid),
    {
      uid,
      parentCreated: true,
      updatedAt: serverTimestamp(),
      ...extra,
    },
    { merge: true }
  );
}

/* =========================================================
 * VANS (clients/bloc-lego/users/{uid}/app/v1.vans)
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
    enabled: v?.enabled !== false,
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
    enabled: v?.enabled !== false,
  }));

  await ensureUserRoot(uid);

  await setDoc(
    appDocRef(uid),
    { vans: list, updatedAt: serverTimestamp(), uid },
    { merge: true }
  );
}

/* =========================================================
 * MOULURES (clients/bloc-lego/users/{uid}/app/v1.moulures)
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

  await ensureUserRoot(uid);

  await setDoc(
    appDocRef(uid),
    { moulures: out, updatedAt: serverTimestamp(), uid },
    { merge: true }
  );
}

/* =========================================================
 * RUNS (clients/bloc-lego/users/{uid}/runs/*)
 * ======================================================= */
export async function saveRun(resultPayload) {
  const uid = requireUid();

  await ensureUserRoot(uid);

  const ref = await addDoc(runsColRef(uid), {
    createdAt: serverTimestamp(),
    uid,
    payload: resultPayload,
  });
  return ref.id;
}

/* =========================================================
 * TRAJETS (partagés: /clients/bloc-lego/trajets/*)
 * ======================================================= */
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

export function subscribeTrajets(callback) {
  const q = query(trajetsSharedCol, orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() || {}) }));
    callback(out);
  });
  return unsub;
}

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
  const ref = doc(db, "clients", "bloc-lego", "trajets", trajetId);
  await deleteDoc(ref);
}

/* =========================================================
 * MIGRATION - anciens trajets racine -> clients/bloc-lego/trajets
 * ======================================================= */
export async function migrateOldTrajetsToClient() {
  const oldCol = collection(db, "trajets");
  const newCol = collection(db, "clients", "bloc-lego", "trajets");

  const snap = await getDocs(oldCol);
  if (snap.empty) return { copied: 0 };

  let copied = 0;

  for (const d of snap.docs) {
    const data = d.data() || {};
    const newRef = doc(newCol, d.id);

    await setDoc(
      newRef,
      {
        ...data,
        migratedAt: serverTimestamp(),
        migratedFrom: "trajets",
      },
      { merge: true }
    );

    copied += 1;
  }

  return { copied };
}

/* =========================================================
 * MIGRATION - anciens users/{uid}/app/v1 -> clients/bloc-lego/users/{uid}/app/v1
 * ======================================================= */
export async function migrateOldUserAppToClient() {
  const uid = requireUid();

  const oldSnap = await getDoc(oldAppDocRef(uid));
  if (!oldSnap.exists()) return { copied: 0 };

  const data = oldSnap.data() || {};

  // crée le parent users/{uid}
  await ensureUserRoot(uid, {
    migratedAt: serverTimestamp(),
    migratedFrom: "users/{uid}",
  });

  // copie app/v1
  await setDoc(
    appDocRef(uid),
    {
      ...data,
      uid,
      migratedAt: serverTimestamp(),
      migratedFrom: "users/{uid}/app/v1",
    },
    { merge: true }
  );

  return { copied: 1 };
}

/* =========================================================
 * MIGRATION - anciens users/{uid}/runs/* -> clients/bloc-lego/users/{uid}/runs/*
 * ======================================================= */
export async function migrateOldRunsToClient() {
  const uid = requireUid();

  const oldSnap = await getDocs(oldRunsColRef(uid));
  if (oldSnap.empty) return { copied: 0 };

  // crée le parent users/{uid}
  await ensureUserRoot(uid, {
    migratedAt: serverTimestamp(),
    migratedFrom: "users/{uid}",
  });

  let copied = 0;

  for (const d of oldSnap.docs) {
    const data = d.data() || {};
    const newRef = doc(db, "clients", "bloc-lego", "users", uid, "runs", d.id);

    await setDoc(
      newRef,
      {
        ...data,
        uid,
        migratedAt: serverTimestamp(),
        migratedFrom: "users/{uid}/runs",
      },
      { merge: true }
    );

    copied += 1;
  }

  return { copied };
}

/* =========================================================
 * MIGRATION - tout l'espace user courant
 * ======================================================= */
export async function migrateOldUserDataToClient() {
  const a = await migrateOldUserAppToClient();
  const b = await migrateOldRunsToClient();
  return {
    appCopied: a.copied || 0,
    runsCopied: b.copied || 0,
  };
}

/* =========================================================
 * OUTIL - crée explicitement le parent users/{uid} pour user courant
 * ======================================================= */
export async function ensureCurrentUserRootDoc() {
  const uid = requireUid();
  await ensureUserRoot(uid);
  return { ok: true, uid };
}