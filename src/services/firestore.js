import {
  doc, getDoc, setDoc, serverTimestamp, addDoc, collection
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// Emplacements
const DOC_VANS     = doc(db, "settings", "vans");
const DOC_MOULURES = doc(db, "moulures", "default");
const COL_RUNS     = "runs";

// Helpers
const numOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// --------- VANNES (1 doc: settings/vans)
export async function loadVans() {
  const snap = await getDoc(DOC_VANS);
  if (!snap.exists()) return [];
  const data = snap.data();
  const list = Array.isArray(data.list) ? data.list : [];
  // Normalisation simple
  return list.map(v => ({
    name: String(v.name ?? ""),
    l: v.l ?? null,
    w: v.w ?? null,
    h: v.h ?? null,
    cost: v.cost ?? null,
    maxW: v.maxW ?? null, // poids max
  }));
}

export async function saveVans(vansArray) {
  const list = (Array.isArray(vansArray) ? vansArray : []).map(v => ({
    name: String(v.name ?? ""),
    l: numOrNull(v.l),
    w: numOrNull(v.w),
    h: numOrNull(v.h),
    cost: numOrNull(v.cost),
    maxW: numOrNull(v.maxW),
  }));
  await setDoc(DOC_VANS, {
    list,
    updatedAt: serverTimestamp(),
    uid: auth.currentUser?.uid || null,
  }, { merge: false });
}

// --------- MOULURES (1 doc: moulures/default)
export async function loadMoulures() {
  const snap = await getDoc(DOC_MOULURES);
  if (!snap.exists()) return [];
  const data = snap.data();
  const rows = Array.isArray(data.rows) ? data.rows : [];
  // Nouveau format: id, l, h, wt (on ignore anciens champs s’ils existent)
  return rows.map(r => ({
    id: String(r.id ?? ""),
    l: r.l ?? null,
    h: r.h ?? null,
    wt: r.wt ?? null, // poids/unité
  }));
}

export async function saveMoulures(rows) {
  const out = (Array.isArray(rows) ? rows : []).map(r => ({
    id: String(r.id ?? ""),
    l: numOrNull(r.l),
    h: numOrNull(r.h),
    wt: numOrNull(r.wt), // poids/unité
  }));
  await setDoc(DOC_MOULURES, {
    rows: out,
    updatedAt: serverTimestamp(),
    uid: auth.currentUser?.uid || null,
  }, { merge: false });
}

// --------- RUNS (log résultat)
export async function saveRun(resultPayload) {
  const ref = await addDoc(collection(db, COL_RUNS), {
    createdAt: serverTimestamp(),
    uid: auth.currentUser?.uid || null,
    payload: resultPayload,
  });
  return ref.id;
}
