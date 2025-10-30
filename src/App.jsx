// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { packAllWithCost } from "./packing3d_multi";
import Ortho2D from "./components/Ortho2D";
import View3D from "./components/View3D";
import { ensureSignedIn } from "./lib/firebase";
import { loadVans, saveVans, loadMoulures, saveMoulures, saveRun } from "./services/firestore";

// Palette contrastée et stable (12 couleurs)
const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b",
  "#9333ea", "#0ea5e9", "#ef4444", "#10b981",
  "#f97316", "#a855f7", "#14b8a6", "#e11d48",
];

export default function App() {
  // ----------------- État local
  const [vans, setVans] = useState([
    { code: "48", name: "Vanne 48′", l: 576, w: 100, h: 96, cost: 700 },
    { code: "53", name: "Vanne 53′", l: 636, w: 100, h: 96, cost: 850 },
  ]);

  const [rows, setRows] = useState([
    { id: "A", l: 120, w: 45, h: 33, qty: 20 },
    { id: "B", l: 80,  w: 10, h: 8,  qty: 30 },
  ]);

  const [result, setResult] = useState(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [msg, setMsg] = useState("");

  // ----------------- Couleurs
  const colorMap = useMemo(() => {
    const types = rows.map(r => String(r.id ?? "")).filter(Boolean);
    const uniq = [...new Set(types)];
    const map = {};
    uniq.forEach((t, i) => { map[t] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [rows]);

  // ----------------- Helpers
  function updateVan(i, key, val) {
    setVans(v => v.map((x, idx) => idx === i ? { ...x, [key]: key==="name"? val : Number(val) } : x));
  }
  function addVan() {
    setVans(v => [...v, { code: "", name: "Nouvelle vanne", l: 0, w: 0, h: 0, cost: 0 }]);
  }
  function delVan(i) { setVans(v => v.filter((_, idx) => idx !== i)); }

  function updateRow(i, key, val) {
    const v = key === "id" ? val : Number(val);
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  }
  function addRow() {
    setRows(r => [...r, { id: String.fromCharCode(65 + (r.length % 26)), l: 0, w: 0, h: 0, qty: 1 }]);
  }
  function delRow(i) { setRows(r => r.filter((_, idx) => idx !== i)); }

  // ----------------- Firebase: auto sign-in
  useEffect(() => {
    ensureSignedIn().catch(console.error);
  }, []);

  // ----------------- Actions Firebase
  async function handleLoadVans() {
    try {
      setLoadingFb(true);
      const arr = await loadVans();
      if (arr.length) setVans(arr);
      setMsg("Vannes chargées depuis Firestore.");
    } catch (e) {
      console.error(e);
      setMsg("Erreur chargement vannes.");
    } finally {
      setLoadingFb(false);
    }
  }
  async function handleSaveVans() {
    try {
      setLoadingFb(true);
      await saveVans(vans);
      setMsg("Vannes enregistrées dans Firestore.");
    } catch (e) {
      console.error(e);
      setMsg("Erreur sauvegarde vannes.");
    } finally {
      setLoadingFb(false);
    }
  }
  async function handleLoadMoulures() {
    try {
      setLoadingFb(true);
      const arr = await loadMoulures();
      if (arr.length) setRows(arr);
      setMsg("Moulures chargées depuis Firestore.");
    } catch (e) {
      console.error(e);
      setMsg("Erreur chargement moulures.");
    } finally {
      setLoadingFb(false);
    }
  }
  async function handleSaveMoulures() {
    try {
      setLoadingFb(true);
      await saveMoulures(rows);
      setMsg("Moulures enregistrées dans Firestore.");
    } catch (e) {
      console.error(e);
      setMsg("Erreur sauvegarde moulures.");
    } finally {
      setLoadingFb(false);
    }
  }
  async function handleSaveRun() {
    try {
      if (!result) { setMsg("Aucun résultat à enregistrer."); return; }
      setLoadingFb(true);
      const id = await saveRun(result);
      setMsg(`Run enregistré (id: ${id}).`);
    } catch (e) {
      console.error(e);
      setMsg("Erreur sauvegarde du résultat.");
    } finally {
      setLoadingFb(false);
    }
  }

  // ----------------- Calcul
  function run() {
    const items = rows.filter(r => r.l > 0 && r.w > 0 && r.h > 0 && (Number(r.qty) || 0) > 0);
    const vanTypes = vans.map(v => ({
      code: String(v.code||""),
      name: String(v.name||""),
      l: Number(v.l)||0, w: Number(v.w)||0, h: Number(v.h)||0,
    }));
    const costs = Object.fromEntries(vans.map(v => [String(v.code||""), Number(v.cost)||0]));

    const res = packAllWithCost({
      vanTypes,
      items,
      opts: {
        costs,
        clearance: 0,          // pas de marge
        keepZBase: false,      // empilement autorisé
        lockAxesFully: true,   // orientation fixe
        maxStackHeight: 1e9,
        strategy: "min_cost",  // minimise le coût (≈ nb de vannes)
      },
    });
    setResult(res);
  }

  // ----------------- UI
  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", padding: 16, maxWidth: 1320, margin: "0 auto" }}>
      <h1>🧱 Bloc-LEGO — Chargement optimisé (Firebase)</h1>
      <p style={{ marginTop: 4, opacity: 0.9 }}>
        Unités : pouces (″). Orientation fixe (L→X, l→Y, H→Z). Empilement autorisé.  
        Contrainte : au plus 2 moulures de large. Objectif : minimiser le coût total.
      </p>

      {/* Actions Firebase */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <button onClick={handleLoadVans} disabled={loadingFb}>Charger vannes</button>
        <button onClick={handleSaveVans} disabled={loadingFb}>Sauver vannes</button>
        <span style={{ margin: "0 12px", opacity: .6 }}>|</span>
        <button onClick={handleLoadMoulures} disabled={loadingFb}>Charger moulures</button>
        <button onClick={handleSaveMoulures} disabled={loadingFb}>Sauver moulures</button>
        <span style={{ margin: "0 12px", opacity: .6 }}>|</span>
        <button onClick={handleSaveRun} disabled={loadingFb || !result}>Enregistrer le résultat</button>
        {msg && <span style={{ opacity: .8 }}>• {msg}</span>}
      </div>

      {/* Vannes éditables */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {vans.map((v, i) => (
          <fieldset key={i} style={{ padding: 12, borderRadius: 8 }}>
            <legend><b>Vanne {v.code || i+1}</b></legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              <label>Code
                <input value={v.code} onChange={e=>updateVan(i,"code",e.target.value)} />
              </label>
              <label>Nom
                <input value={v.name} onChange={e=>updateVan(i,"name",e.target.value)} />
              </label>
              <label>Longueur X
                <input type="number" value={v.l} onChange={e=>updateVan(i,"l",e.target.value)} />
              </label>
              <label>Largeur Y
                <input type="number" value={v.w} onChange={e=>updateVan(i,"w",e.target.value)} />
              </label>
              <label>Hauteur Z
                <input type="number" value={v.h} onChange={e=>updateVan(i,"h",e.target.value)} />
              </label>
              <label>Coût
                <input type="number" value={v.cost} onChange={e=>updateVan(i,"cost",e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              <button onClick={()=>delVan(i)}>Supprimer cette vanne</button>
              {i === vans.length-1 && <button onClick={addVan}>+ Ajouter un type de vanne</button>}
            </div>
          </fieldset>
        ))}
      </section>

      {/* Moulures */}
      <h2 style={{ marginTop: 16 }}>Moulures (prismes) — pouces (″)</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th><th>L (X)</th><th>l (Y)</th><th>H (Z)</th><th>Qté</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input value={r.id} onChange={e=>updateRow(i,"id",e.target.value)} style={{ width: 80 }} /></td>
              <td><input type="number" value={r.l} onChange={e=>updateRow(i,"l",e.target.value)} /></td>
              <td><input type="number" value={r.w} onChange={e=>updateRow(i,"w",e.target.value)} /></td>
              <td><input type="number" value={r.h} onChange={e=>updateRow(i,"h",e.target.value)} /></td>
              <td><input type="number" value={r.qty} onChange={e=>updateRow(i,"qty",e.target.value)} /></td>
              <td><button onClick={()=>delRow(i)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={addRow}>+ Ajouter une ligne</button>
        <button onClick={run}>Calculer</button>
      </div>

      {/* Résultats + vues */}
      {result && (
        <section style={{ marginTop: 20 }}>
          <h2>Résultats</h2>
          <p>
            <b>Vannes utilisées:</b> {result.stats.usedVans} — <b>Coût total:</b> {result.stats.totalCost.toLocaleString()} — <b>Items non placés:</b> {result.stats.unplacedCount}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {result.vans.map((v, idx) => (
              <div key={idx} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 18 }}>
                  {v.name || v.code || `Vanne ${idx+1}`} — Remplissage (volume) : {Math.round((v.fillRate || 0) * 100)}%
                </div>

                {/* 3D */}
                <View3D van={v} colorMap={colorMap} height={420} />

                {/* 2D */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 10 }}>
                  <Ortho2D colorMap={colorMap} van={v} axes={["x","y"]} labels={["X (″)", "Y (″)"]} title="Vue de dessus — Plan (X × Y)" />
                  <Ortho2D colorMap={colorMap} van={v} axes={["x","z"]} labels={["X (″)", "Z (″)"]} title="Vue de face — Façade (X × Z)" />
                  <Ortho2D colorMap={colorMap} van={v} axes={["y","z"]} labels={["Y (″)", "Z (″)"]} title="Vue de côté — Profil (Y × Z)" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        table th, table td { border: 1px solid #e5e7eb; padding: 6px; }
        table th { background: #f9fafb; text-align: left; }
        input { width: 100%; padding: 6px 8px; box-sizing: border-box; }
        button { padding: 8px 12px; }
        fieldset { border: 1px solid #e5e7eb; }
        legend { padding: 0 6px; }
        label { display: grid; gap: 4px; font-size: 14px; }
      `}</style>
    </div>
  );
}
