// src/services/firestore.js
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, addDoc
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// ------- Collections
const COL_VANS   = "vans";
const COL_MOULURES = "moulures";
const COL_RUNS   = "runs";

// ------- Vannes
export async function loadVans() {
  const snap = await getDocs(collection(db, COL_VANS));
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
  // tri stable par code si présent (48, 53)
  arr.sort((a,b)=> String(a.code||"").localeCompare(String(b.code||"")));
  return arr;
}
export async function saveVans(vansArray) {
  // upsert (doc id = code si fourni sinon auto)
  const ops = vansArray.map(v => {
    const id = v.code ? String(v.code) : undefined;
    const ref = id ? doc(db, COL_VANS, id) : doc(collection(db, COL_VANS));
    const data = {
      code: v.code ?? id ?? null,
      name: v.name ?? "",
      l: Number(v.l)||0, w: Number(v.w)||0, h: Number(v.h)||0,
      cost: Number(v.cost)||0,
      updatedAt: serverTimestamp(),
      uid: auth.currentUser?.uid || null,
    };
    return setDoc(ref, data, { merge: true });
  });
  await Promise.all(ops);
}

// ------- Moulures (profil global)
export async function loadMoulures() {
  // On stocke UN document "default" qui contient un tableau rows
  const ref = doc(db, COL_MOULURES, "default");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data.rows) ? data.rows : [];
}
export async function saveMoulures(rows) {
  const ref = doc(db, COL_MOULURES, "default");
  await setDoc(ref, {
    rows: rows.map(r => ({
      id: String(r.id||""),
      l: Number(r.l)||0, w: Number(r.w)||0, h: Number(r.h)||0,
      qty: Number(r.qty)||0,
    })),
    updatedAt: serverTimestamp(),
    uid: auth.currentUser?.uid || null,
  }, { merge: true });
}

// ------- Archivage d’un résultat (run)
export async function saveRun(resultPayload) {
  const ref = await addDoc(collection(db, COL_RUNS), {
    createdAt: serverTimestamp(),
    uid: auth.currentUser?.uid || null,
    payload: resultPayload, // {vans:[...], stats:{...}, remaining:[...]}
  });
  return ref.id;
}
