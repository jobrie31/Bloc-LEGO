// src/components/TrajetsMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { saveTrajet, subscribeTrajets, deleteTrajet } from "../services/firestore";
import TrajetPreviewModal from "./TrajetPreviewModal";

/**
 * TrajetsMenu — panneau latéral gauche pour:
 * - Donner un titre et ENREGISTRER le trajet courant
 * - Lister les trajets sauvegardés (titre, date, coût total, #vans)
 * - Ouvrir un POPUP d'aperçu (vans d'abord, puis bundles, + 3D)
 *
 * Props: signedIn, user, vans, rows, result, billing
 */
export default function TrajetsMenu({
  signedIn,
  user,
  vans,
  rows,
  result,
  billing,
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  // Compte “vans utilisées” affiché façon UI (bi-train = 1)
  const usedVanPacksCount = useMemo(() => {
    if (!result || !Array.isArray(result.vans)) return 0;
    const map = new Map();
    for (const v of result.vans) {
      const key = String(v.group || v.name || "").trim() || `__solo_${v.code || ""}`;
      const groupSize = Number(v.groupSize || 1);
      if (!map.has(key)) map.set(key, { count: 1, groupSize });
      else {
        const t = map.get(key);
        t.count += 1;
        t.groupSize = Math.max(t.groupSize, groupSize || 1);
      }
    }
    let packs = 0;
    for (const [, g] of map) {
      if ((g.groupSize || 1) <= 1) packs += g.count;
      else packs += Math.ceil(g.count / g.groupSize);
    }
    return packs;
  }, [result]);

  // 🔴 Temps réel (partagé)
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeTrajets((arr) => {
      setItems(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // construit un breakdown explicite des coûts par van construite
  function buildCostBreakdown(vansBuilt) {
    if (!Array.isArray(vansBuilt)) return [];
    return vansBuilt.map((v, i) => ({
      index: i + 1,
      code: v.code || "",
      name: v.name || "",
      group: v.group || "",
      groupSize: Number(v.groupSize || 1),
      costPerVan: Number(v.costPerVan || 0),
      maxWeight: Number(v.maxWeight || 0) || null,
      weightUsed: Number(v.weightUsed || 0) || 0,
    }));
  }

  // Enregistrer le trajet courant (partagé)
  async function handleSave() {
    setErr("");
    if (!signedIn) { setErr("Tu dois être connecté."); return; }
    if (!result || !Array.isArray(result.vans) || result.vans.length === 0) {
      setErr("Aucun résultat à enregistrer. Lance d’abord le calcul.");
      return;
    }
    if (!title.trim()) { setErr("Donne un titre au trajet."); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim(),
        context: {
          userEmail: user?.email || "",
          vansSnapshot: vans || [],     // inclut les 'cost' saisis
          rowsSnapshot: rows || [],
        },
        result: {
          stats: result.stats || {},
          vans: result.vans || [],
          billing: {
            totalCost: Number(billing?.totalCost || 0),
            usedVanPacks: usedVanPacksCount,
            usedVansRaw: Number(billing?.usedVans || 0),
          },
          costBreakdown: buildCostBreakdown(result.vans || []),
        },
      };
      await saveTrajet(payload, user);
      setTitle("");
      setNotes("");
      // onSnapshot mettra la liste à jour automatiquement
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function openPreview(trajet) {
    setPreviewItem(trajet);
    setPreviewOpen(true);
  }

  async function removeOne(id) {
    if (!id) return;
    if (!window.confirm("Supprimer ce trajet ?")) return;
    try {
      await deleteTrajet(id);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  return (
    <>
      <aside className="trajets-menu">
        <div className="tm-head">
          <div className="tm-title">🚚 Trajets (partagés)</div>
          <div className="tm-sub">Toute l’équipe voit les enregistrements</div>
        </div>

        <div className="tm-form">
          <label className="tm-label">Titre du trajet</label>
          <input
            className="tm-input"
            placeholder="ex: Montréal → Québec (Client ABC)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!signedIn || saving}
          />
          <label className="tm-label">Notes (optionnel)</label>
          <textarea
            className="tm-textarea"
            placeholder="Infos complémentaires, contraintes, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!signedIn || saving}
          />
          <button
            className="tm-save"
            onClick={handleSave}
            disabled={!signedIn || saving || !result}
            title={!result ? "Fais un calcul d’abord" : "Enregistrer le trajet courant"}
          >
            💾 Enregistrer ce trajet
          </button>

          <div className="tm-meta">
            <div><b>Coût total:</b> {Number(billing?.totalCost || 0).toLocaleString()}</div>
            <div><b>Vans (affichage):</b> {usedVanPacksCount}</div>
          </div>

          {err && <div className="tm-error">{err}</div>}
          {!signedIn && <div className="tm-hint">Connecte-toi pour enregistrer des trajets.</div>}
        </div>

        <div className="tm-list-head">
          <div className="tm-list-title">Trajets enregistrés (équipe)</div>
          {loading && <div className="tm-list-loading">Chargement…</div>}
        </div>

        <div className="tm-list">
          {items.length === 0 && !loading && (
            <div className="tm-empty">Aucun trajet pour l’instant.</div>
          )}
          {items.map((t) => (
            <div key={t.id} className="tm-item">
              <div className="tm-item-main">
                <div className="tm-item-title">{t.title || "Sans titre"}</div>
                <div className="tm-item-sub">
                  {formatDateTime(t.createdAt)} — <b>{fmtMoney(t.result?.billing?.totalCost)}</b> — {String(t.result?.billing?.usedVanPacks || 0)} van(s)
                  {t.author?.email ? <> — <i>{t.author.email}</i></> : null}
                </div>
              </div>
              <div className="tm-item-actions">
                <button className="tm-btn" onClick={() => openPreview(t)} title="Aperçu">👁️</button>
                <button className="tm-btn danger" onClick={() => removeOne(t.id)} title="Supprimer">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <TrajetPreviewModal
        open={previewOpen}
        trajet={previewItem}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

/* ---------- utils locaux ---------- */
function fmtMoney(x) {
  const n = Number(x || 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0 });
}
function formatDateTime(ts) {
  try {
    if (ts && typeof ts === "object" && Number.isFinite(ts.seconds)) {
      const d = new Date(ts.seconds * 1000);
      return d.toLocaleString();
    }
    if (typeof ts === "string") {
      return new Date(ts).toLocaleString();
    }
  } catch {}
  return "—";
}
