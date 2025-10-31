import { useEffect, useMemo, useRef, useState } from "react";
import View3D from "./components/View3D";
import ExcelPasteModal from "./components/ExcelPasteModal";
import { ensureSignedIn } from "./lib/firebase";
import { loadVans, saveVans, loadMoulures, saveMoulures } from "./services/firestore";

// Palette élargie (~48 couleurs) pour éviter l’entremêlement
const PALETTE = [
  "#2563eb","#16a34a","#dc2626","#f59e0b","#9333ea","#0ea5e9","#ef4444","#10b981",
  "#f97316","#a855f7","#14b8a6","#e11d48","#1f2937","#64748b","#059669","#d97706",
  "#7c3aed","#22d3ee","#16a085","#c0392b","#8e44ad","#2980b9","#2ecc71","#e67e22",
  "#e84393","#00cec9","#6c5ce7","#fdcb6e","#e17055","#0984e3","#00b894","#2d3436",
  "#ff7675","#74b9ff","#55efc4","#ffeaa7","#fab1a0","#81ecec","#b2bec3","#a29bfe",
  "#6366f1","#84cc16","#06b6d4","#f43f5e","#fb923c","#10a37f","#d946ef","#22c55e"
];

// Valeurs par défaut
const DEFAULT_ITEM_WIDTH = 48; // l (Y)
const DEFAULT_ITEM_QTY = 1;

export default function App() {
  // -------- État
  // vannes: { name:"", l:"", w:"", h:"", cost:"", maxW:"" }
  const [vans, setVans] = useState([]);
  // bundles: { id:"", l:"", h:"", wt:"" }
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [msg, setMsg] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  // Auto-save (logique conservée; UI retirée)
  const [autosave, setAutosave] = useState({
    vans: "idle", rows: "idle",
    vansAt: null, rowsAt: null,
    vansErr: "", rowsErr: "",
  });
  const hydratingRef = useRef({ vans: false, rows: false });
  const saveTimersRef = useRef({ vans: null, rows: null });

  // Helpers
  const sv = (x) => (x ?? "");
  const isNum = (k) => ["l","h","cost","maxW","wt","w"].includes(k);
  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

  // ---------- Consolidation des lignes par ID
  // Règles: pour chaque ID, L = max(L), H = somme(H), wt = somme(wt)
  function consolidateRows(list) {
    const byId = new Map();

    for (const r of list || []) {
      const id = String(r?.id ?? "").trim();
      const L = toNum(r?.l);
      const H = toNum(r?.h);
      const WT = toNum(r?.wt);

      if (!id) {
        // Sans ID : on garde tel quel (pas de fusion avec d'autres)
        const key = `__noid__${Math.random()}`;
        byId.set(key, { id: "", l: L, h: H, wt: WT });
        continue;
      }

      if (!byId.has(id)) {
        byId.set(id, { id, l: L, h: H, wt: WT });
      } else {
        const t = byId.get(id);
        const newL = Math.max(t.l, L);
        const newH = t.h + H;
        const newWt = t.wt + WT;
        byId.set(id, { id, l: newL, h: newH, wt: newWt });
      }
    }

    return [...byId.values()].sort(
      (a, b) => String(a.id).localeCompare(String(b.id)) || b.l - a.l
    );
  }

  // Couleurs par type d’item
  const colorMap = useMemo(() => {
    const types = rows.map(r => String(r.id ?? "")).filter(Boolean);
    const uniq = [...new Set(types)];
    const map = {};
    uniq.forEach((t, i) => (map[t] = PALETTE[i % PALETTE.length]));
    return map;
  }, [rows]);

  // Fallback coût
  const costByName = useMemo(
    () => Object.fromEntries(vans.map(v => [String(v.name || ""), Number(v.cost) || 0])),
    [vans]
  );

  // -------- Auto-save
  const scheduleSave = (kind) => {
    if (!signedIn) return;
    if (hydratingRef.current[kind]) return;
    if (saveTimersRef.current[kind]) clearTimeout(saveTimersRef.current[kind]);
    setAutosave(s => ({ ...s, [kind]: "saving", [`${kind}Err`]: "" }));
    saveTimersRef.current[kind] = setTimeout(async () => {
      try {
        if (kind === "vans") {
          await saveVans(vans);
          setAutosave(s => ({ ...s, vans: "saved", vansAt: new Date(), vansErr: "" }));
        } else {
          await saveMoulures(rows);
          setAutosave(s => ({ ...s, rows: "saved", rowsAt: new Date(), rowsErr: "" }));
        }
      } catch (e) {
        console.error(e);
        setAutosave(s => ({ ...s, [kind]: "error", [`${kind}Err`]: String(e?.message || e) }));
      }
    }, 500);
  };

  const saveNow = async (kind) => {
    if (!signedIn) return;
    try {
      if (kind === "vans") {
        await saveVans(vans);
        setAutosave(s => ({ ...s, vans: "saved", vansAt: new Date(), vansErr: "" }));
      } else {
        await saveMoulures(rows);
        setAutosave(s => ({ ...s, rows: "saved", rowsAt: new Date(), rowsErr: "" }));
      }
    } catch (e) {
      console.error(e);
      setAutosave(s => ({ ...s, [kind]: "error", [`${kind}Err`]: String(e?.message || e) }));
    }
  };

  const flushPendingSaves = async () => {
    for (const k of ["vans","rows"]) {
      if (saveTimersRef.current[k]) {
        clearTimeout(saveTimersRef.current[k]);
        saveTimersRef.current[k] = null;
        await saveNow(k);
      }
    }
  };

  // -------- CRUD Vannes
  function updateVan(i, key, val) {
    setVans(v => v.map((x, idx) => idx === i ? { ...x, [key]: isNum(key) ? (val === "" ? "" : val) : val } : x));
    scheduleSave("vans");
  }
  function addVan() {
    setVans(v => [...v, { name: "", l: "", w: "", h: "", cost: "", maxW: "" }]);
    scheduleSave("vans");
  }
  function delVan(i) {
    setVans(v => v.filter((_, idx) => idx !== i));
    scheduleSave("vans");
  }

  // -------- CRUD Bundles
  function updateRow(i, key, val) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: isNum(key) ? (val === "" ? "" : val) : val } : row));
    scheduleSave("rows");
  }
  function addRow() {
    setRows(r => [...r, { id: "", l: "", h: "", wt: "" }]);
    scheduleSave("rows");
  }
  function delRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i));
    scheduleSave("rows");
  }
  function clearAllRows() {
    setRows([]);
    try { localStorage.removeItem(LS_KEYS.rows); } catch {}
    scheduleSave("rows");
    if (signedIn) saveMoulures([]).catch(()=>{});
  }

  // -------- Import Excel/Sheets (fusion + consolidation)
  function importRows(rowsImported){
    setRows(prev => {
      const merged = [
        ...(prev || []).map(r => ({ id:String(r.id||""), l:toNum(r.l), h:toNum(r.h), wt:toNum(r.wt) })),
        ...(rowsImported || []).map(r => ({ id:String(r.id||""), l:toNum(r.l), h:toNum(r.h), wt:toNum(r.wt) })),
      ];
      const arr = consolidateRows(merged);
      if (signedIn) {
        saveMoulures(arr).catch(()=>{});
      }
      return arr;
    });
    scheduleSave("rows");
  }

  // -------- Init (auth + data) — préserver Bundles au refresh
  const LS_KEYS = { vans: "bloclego.vans", rows: "bloclego.rows" };

  useEffect(() => {
    (async () => {
      try {
        await ensureSignedIn();
        setSignedIn(true);

        // 1) Charger d’abord le localStorage (source de vérité au refresh)
        let lsV = null, lsR = null;
        try {
          lsV = JSON.parse(localStorage.getItem(LS_KEYS.vans) || "null");
          lsR = JSON.parse(localStorage.getItem(LS_KEYS.rows) || "null");
        } catch {}

        if (Array.isArray(lsV)) setVans(lsV);
        if (Array.isArray(lsR)) setRows(consolidateRows(lsR));

        // 2) Hydratation Firestore SANS écraser le local si local non vide
        setLoadingFb(true);
        hydratingRef.current.vans = true;
        hydratingRef.current.rows = true;

        const [arrV, arrR] = await Promise.all([loadVans(), loadMoulures()]);
        const convRows = (arrR || []).map(r => ({
          id: String(r.id || ""),
          l: toNum(r.l),
          h: toNum(r.h),
          wt: toNum(r.wt),
        }));

        // Vannes : si Firestore a des données, on les prend, sinon on garde local
        if (Array.isArray(arrV) && arrV.length > 0) {
          setVans(arrV);
        } else if (Array.isArray(lsV) && lsV.length > 0 && signedIn) {
          // Cloud vide mais local non vide : pousser vers Firestore
          saveVans(lsV).catch(() => {});
        }

        // Bundles : NE PAS écraser le local si déjà présent
        if (Array.isArray(convRows) && convRows.length > 0) {
          // Si local est vide, on prend Firestore; sinon on garde local tel quel
          setRows(prev => (prev && prev.length > 0 ? prev : consolidateRows(convRows)));
        } else if (Array.isArray(lsR) && lsR.length > 0 && signedIn) {
          // Firestore vide mais local non vide : pousser vers Firestore
          saveMoulures(consolidateRows(lsR)).catch(() => {});
        }

      } catch (e) {
        console.error("Init/auth:", e);
        setMsg("Erreur d’authentification ou de chargement initial.");
      } finally {
        hydratingRef.current.vans = false;
        hydratingRef.current.rows = false;
        setLoadingFb(false);
      }
    })();

    const handleBeforeUnload = () => { flushPendingSaves(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // persistance locale (secours)
  useEffect(() => { try { localStorage.setItem(LS_KEYS.vans, JSON.stringify(vans)); } catch {} }, [vans]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.rows, JSON.stringify(rows)); } catch {} }, [rows]);

  // -------- Solveur
  function expandItems() {
    const out = [];
    for (const r of rows) {
      const qty = DEFAULT_ITEM_QTY; // 1
      const obj = { id: r.id ?? "", l: toNum(r.l), w: DEFAULT_ITEM_WIDTH, h: toNum(r.h), wt: toNum(r.wt) };
      if (obj.l > 0 && obj.w > 0 && obj.h > 0 && qty > 0) {
        for (let i = 0; i < qty; i++) out.push({ ...obj });
      }
    }
    return out;
  }

  function normalizeTypes() {
    return vans
      .map((v, i) => ({
        code: String((v.name || "").trim()) || `van_${i + 1}`,
        name: String(v.name || ""),
        l: toNum(v.l), w: toNum(v.w), h: toNum(v.h),
        cost: toNum(v.cost),
        maxW: toNum(v.maxW),
      }))
      .filter(v => v.l > 0 && v.w > 0 && v.h > 0)
      .sort((a,b) => a.cost - b.cost);
  }

  function makePilesByHeight(items, Hcap) {
    const sorted = [...items].sort((a,b)=>b.h-a.h);
    const piles = [];
    for (const it of sorted) {
      let placed = false;
      for (const p of piles) {
        if (p.h + it.h <= Hcap) {
          p.h += it.h;
          if (it.l > p.len) p.len = it.l;
          p.wt += (Number(it.wt)||0);
          p.items.push(it);
          p.items.sort((a,b)=> (b.h - a.h) || (b.l - a.l) || ((b.l*b.w*b.h)-(a.l*a.w*a.h)));
          placed = true;
          break;
        }
      }
      if (!placed) {
        piles.push({ h: it.h, len: it.l, wt: (Number(it.wt)||0), items:[it] });
      }
    }
    return piles;
  }

  // Packing coalescé par colonne
  function simulateFillOneVan(piles, type) {
    const Hcap = type.h;
    const Lcap = type.l;
    const idxs = [...piles.keys()].sort((i, j) => piles[j].len - piles[i].len || piles[j].h - piles[i].h);

    const cols = [ { stacks: [], used: 0 }, { stacks: [], used: 0 } ];
    const chosen = new Set();
    let curW = 0;

    const tryPlaceOnCol = (col, pIdx) => {
      const p = piles[pIdx];
      let best = null;
      for (let s = 0; s < col.stacks.length; s++) {
        const st = col.stacks[s];
        if (st.h + p.h <= Hcap) {
          const newLen = Math.max(st.len, p.len);
          const delta = newLen - st.len;
          const newColUsed = col.used + delta;
          if (newColUsed <= Lcap) {
            const score = newColUsed;
            if (!best || score < best.score) best = { type: 'stack', sIdx: s, newLen, score };
          }
        }
      }
      if (!best) {
        const newColUsed = col.used + p.len;
        if (newColUsed <= Lcap) best = { type: 'new', score: newColUsed };
      }
      return best;
    };

    for (const i of idxs) {
      const p = piles[i];
      if (p.h > Hcap) continue;
      if (type.maxW > 0 && curW + (p.wt || 0) > type.maxW) continue;

      const order = cols[0].used <= cols[1].used ? [0, 1] : [1, 0];
      let bestGlob = null;
      for (const c of order) {
        const option = tryPlaceOnCol(cols[c], i);
        if (option) {
          if (!bestGlob || option.score < bestGlob.score) bestGlob = { ...option, c };
        }
      }
      if (bestGlob) {
        const col = cols[bestGlob.c];
        if (bestGlob.type === 'stack') {
          const st = col.stacks[bestGlob.sIdx];
          if (bestGlob.newLen > st.len) {
            col.used += (bestGlob.newLen - st.len);
            st.len = bestGlob.newLen;
          }
          st.h += p.h;
          st.idxs.push(i);
        } else {
          col.stacks.push({ len: p.len, h: p.h, idxs: [i] });
          col.used += p.len;
        }
        curW += (p.wt || 0);
        chosen.add(i);
      }
    }

    return {
      chosen: [...chosen],
      colUsed: [cols[0].used, cols[1].used],
      weightUsed: curW,
      plan: cols,
    };
  }

  function enforceTallestAtBottom(placed, halfW) {
    const groups = new Map();
    for (const b of placed) {
      const ySlot = b.y < halfW ? 0 : 1;
      const key = `${b.x}|${ySlot}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    const out = [];
    for (const [, list] of groups.entries()) {
      list.sort((a,b)=> (b.h - a.h) || (b.l - a.l) || ((b.l*b.w*b.h)-(a.l*a.w*a.h)));
      let z = 0;
      for (const b of list) { out.push({ ...b, z }); z += b.h; }
    }
    if (out.length !== placed.length) {
      return placed
        .slice()
        .sort((a,b)=> (a.y - b.y) || (a.x - b.x) || (b.h - a.h))
        .map((b)=> ({ ...b }));
    }
    return out;
  }

  function buildVanAndRemove(piles, type, simChosenIdxs, plan) {
    const L = type.l, W = type.w, H = type.h, halfW = W/2;
    let placed = [];
    let curW = 0;

    const cols = plan || [{stacks:[], used:0},{stacks:[], used:0}];
    const usedX = [0, 0];

    for (let c = 0; c < cols.length; c++) {
      const yBase = c === 0 ? 0 : halfW;
      for (const st of cols[c].stacks) {
        const xBase = usedX[c];
        let items = [];
        for (const pIdx of st.idxs) {
          const p = piles[pIdx];
          if (!p) continue;
          items.push(...p.items);
          curW += (Number(p.wt) || 0);
        }
        items.sort((a,b)=> (b.h - a.h) || (b.l - a.l) || ((b.l*b.w*b.h)-(a.l*a.w*a.h)));
        let zCursor = 0;
        for (const it of items) {
          placed.push({ type: String(it.id || ""), l: it.l, w: halfW, h: it.h, x: xBase, y: yBase, z: zCursor, wt: Number(it.wt)||0 });
          zCursor += it.h;
        }
        usedX[c] += st.len;
      }
    }

    placed = enforceTallestAtBottom(placed, halfW);

    const volPlaced = placed.reduce((s,b)=>s + b.l*b.w*b.h, 0);
    const volVan = L*W*H;
    const fillRate = volVan>0 ? Math.max(0,Math.min(1,volPlaced/volVan)) : 0;

    const toRemove = new Set(simChosenIdxs);
    const remaining = [];
    for (let i=0;i<piles.length;i++) if (!toRemove.has(i)) remaining.push(piles[i]);

    const vanObj = { code:type.code, name:type.name, l:L, w:W, h:H, placed, fillRate, weightUsed: curW, maxWeight: type.maxW };
    return { vanObj, remaining };
  }

  function findCheapestSingleVan(piles, types) {
    let best = null;
    for (const t of types) {
      if (piles.some(p => p.h > t.h)) continue;
      const sim = simulateFillOneVan(piles, t);
      if (sim.chosen.length === piles.length) {
        if (!best || t.cost < best.type.cost) best = { type: t, sim };
      }
    }
    return best;
  }

  function pickBestTypeForNextVan(remainingPiles, types) {
    let best = null;
    for (const t of types) {
      if (remainingPiles.some(p => p.h > t.h)) continue;
      const sim = simulateFillOneVan(remainingPiles, t);
      const lenPacked = sim.colUsed[0] + sim.colUsed[1];
      if (lenPacked <= 0) continue;
      if (t.maxW > 0 && sim.weightUsed <= 0) continue;
      const score = t.cost / lenPacked;
      if (!best || score < best.score) best = { type: t, sim, score };
    }
    return best;
  }

  function run() {
    const items = expandItems();
    const types = normalizeTypes();
    if (!items.length || !types.length) { setResult(null); return; }

    const Hcap = Math.min(...types.map(t=>t.h));
    let piles = makePilesByHeight(items, Hcap);

    const Lmax = Math.max(...types.map(t=>t.l));
    const infeasible = piles.filter(p => p.len > Lmax);
    if (infeasible.length) {
      setResult({ stats: { usedVans: 0, totalCost: 0, unplacedCount: infeasible.length }, vans: [], });
      return;
    }

    const one = findCheapestSingleVan(piles, types);
    if (one) {
      const { type, sim } = one;
      const { vanObj } = buildVanAndRemove(piles, type, sim.chosen, sim.plan);
      setResult({ stats: { usedVans: 1, totalCost: type.cost, unplacedCount: 0 }, vans: [vanObj] });
      return;
    }

    const vansBuilt = [];
    let totalCost = 0;
    while (piles.length) {
      const pick = pickBestTypeForNextVan(piles, types);
      if (!pick) break;
      const { type, sim } = pick;
      const { vanObj, remaining } = buildVanAndRemove(piles, type, sim.chosen, sim.plan);
      vansBuilt.push(vanObj);
      totalCost += type.cost;
      piles = remaining;
    }

    setResult({ stats: { usedVans: vansBuilt.length, totalCost, unplacedCount: piles.length }, vans: vansBuilt });
  }

  // -------- UI
  const computedTotalCost = useMemo(() => {
    if (!result) return 0;
    const direct = Number(result?.stats?.totalCost || 0);
    if (direct > 0) return direct;
    return (result?.vans || []).reduce((sum, v) => {
      const c = costByName[String(v?.name || "")] || 0;
      return sum + (Number(c) || 0);
    }, 0);
  }, [result, costByName]);

  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", padding: 16, maxWidth: 1320, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center" }}>🧱 Bloc-LEGO – Chargement optimisé</h1>

      {/* VANS — centré + couleur distincte */}
      <section style={{ display: "grid", placeItems: "center", marginTop: 10 }}>
        <div className="card card-vans">
          <div className="card-head">
            <h2 className="card-title">Vans</h2>
            <div style={{ flex: 1 }} />
            <button onClick={addVan} disabled={!signedIn} className="btn-sm">+ Ajouter une van</button>
          </div>

          {vans.length === 0 && (
            <div className="hint">Aucune van. Ajoute une ligne pour commencer.</div>
          )}

          <div className="table-wrap">
            <table className="tbl tbl-vans">
              <thead>
                <tr>
                  <th>Nom</th><th>Longueur X</th><th>Largeur Y</th><th>Hauteur Z</th><th>Coût</th><th>Poids max</th><th></th>
                </tr>
              </thead>
              <tbody>
                {vans.map((v, i) => (
                  <tr key={i}>
                    <td><input value={sv(v.name)} onChange={e=>updateVan(i,"name",e.target.value)} onBlur={()=>saveNow("vans")} disabled={!signedIn} className="td-in" /></td>
                    <td><input type="number" value={sv(v.l)} onChange={e=>updateVan(i,"l",e.target.value)} onBlur={()=>saveNow("vans")} disabled={!signedIn} className="td-in" /></td>
                    <td><input type="number" value={sv(v.w)} onChange={e=>updateVan(i,"w",e.target.value)} onBlur={()=>saveNow("vans")} disabled={!signedIn} className="td-in" /></td>
                    <td><input type="number" value={sv(v.h)} onChange={e=>updateVan(i,"h",e.target.value)} onBlur={()=>saveNow("vans")} disabled={!signedIn} className="td-in" /></td>
                    <td>
                      <input
                        type="number"
                        value={sv(v.cost)}
                        onChange={e=>updateVan(i,"cost",e.target.value)}
                        onBlur={()=>saveNow("vans")}
                        disabled={!signedIn}
                        className="td-in td-cost"
                      />
                    </td>
                    <td><input type="number" value={sv(v.maxW)} onChange={e=>updateVan(i,"maxW",e.target.value)} onBlur={()=>saveNow("vans")} disabled={!signedIn} className="td-in" /></td>
                    <td style={{ textAlign:"right" }}>
                      <button onClick={()=>delVan(i)} disabled={!signedIn} className="btn-xs">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* BUNDLES — centré + autre couleur */}
      <section style={{ display: "grid", placeItems: "center", marginTop: 16 }}>
        <div className="card card-rows">
          <div className="card-head">
            <h2 className="card-title">Bundles</h2>
            <div style={{ flex: 1 }} />
            <button onClick={()=>setShowPaste(true)} disabled={!signedIn} className="btn-sm">Coller (Excel)</button>
            <button onClick={clearAllRows} disabled={!signedIn || rows.length===0} className="btn-sm">Tout supprimer</button>
          </div>

          {rows.length === 0 && (
            <div className="hint">Aucun bundle. Ajoute une ligne ou colle depuis Excel.</div>
          )}

          <div className="table-wrap small">
            <table className="tbl tbl-rows">
              <thead>
                <tr>
                  <th>ID</th><th>L (X)</th><th>H (Z)</th><th>Poids/unité</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input value={sv(r.id)}  onChange={e=>updateRow(i,"id",e.target.value)}  onBlur={()=>saveNow("rows")} className="td-in" disabled={!signedIn} /></td>
                    <td><input type="number" value={sv(r.l)} onChange={e=>updateRow(i,"l",e.target.value)} onBlur={()=>saveNow("rows")} className="td-in" disabled={!signedIn} /></td>
                    <td><input type="number" value={sv(r.h)} onChange={e=>updateRow(i,"h",e.target.value)} onBlur={()=>saveNow("rows")} className="td-in" disabled={!signedIn} /></td>
                    <td><input type="number" value={sv(r.wt)} onChange={e=>updateRow(i,"wt",e.target.value)} onBlur={()=>saveNow("rows")} className="td-in" disabled={!signedIn} /></td>
                    <td style={{ textAlign:"right" }}>
                      <button onClick={()=>delRow(i)} disabled={!signedIn} className="btn-xs">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems:"center" }}>
              <button onClick={addRow} disabled={!signedIn} className="btn-sm">+ Ajouter une ligne</button>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULER — centré */}
      <div style={{ display:"grid", placeItems:"center", marginTop: 18 }}>
        <button
          onClick={run}
          disabled={vans.length===0 || rows.length===0}
          className="btn-calc"
        >
          CALCULER
        </button>
      </div>

      {/* RÉSULTATS — centrés */}
      {result && (
        <section style={{ display:"grid", placeItems:"center", marginTop: 20 }}>
          <div className="card card-results">
            <h2 className="card-title" style={{ marginBottom: 6 }}>Résultats</h2>
            <p className="resum">
              <b>Vannes utilisées:</b> {result.stats.usedVans} —{" "}
              <b>Coût total:</b> {Number(computedTotalCost).toLocaleString()} —{" "}
              <b>Items non placés (piles restantes):</b> {result.stats.unplacedCount}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {result.vans.map((v, idx) => {
                const label = `Vanne ${idx + 1} - ${sv(v.name) || "—"}`;
                return (
                  <div key={idx} className="van-card">
                    <div className="van-title">{label}</div>
                    <div className="van-weight">
                      Poids: <b>{Number(v.weightUsed||0).toLocaleString()}</b>
                      {v.maxWeight ? <> / <b>{Number(v.maxWeight).toLocaleString()}</b></> : null}
                    </div>
                    <View3D van={v} colorMap={colorMap} height={380} vanLabel={label} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <ExcelPasteModal open={showPaste} onClose={()=>setShowPaste(false)} onImport={importRows} />

      <style>{`
        /* --- Cartes / alignement --- */
        .card { width: 100%; max-width: 980px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #ffffff; box-shadow: 0 6px 16px rgba(0,0,0,.04); }
        .card-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .card-title { font-size: 16px; margin: 0; }
        .hint { opacity: .7; font-style: italic; margin-bottom: 6px; font-size: 12px; }
        .table-wrap { max-width: 980px; margin: 0 auto; }
        .table-wrap.small { max-width: 860px; }

        /* --- Couleurs de cartes pour différencier --- */
        .card-vans { background: #eef2ff; /* indigo-50 */ border-color: #c7d2fe; }
        .card-rows { background: #fff7ed; /* orange-50 */ border-color: #fed7aa; }
        .card-results { background: #f0fdf4; /* green-50 */ border-color: #bbf7d0; }

        /* --- Tableaux --- */
        .tbl { border-collapse: collapse; width: 100%; font-size: 12px; line-height: 1.15; overflow: hidden; border-radius: 8px; }
        .tbl th, .tbl td { border: 1px solid #e5e7eb; padding: 6px; }
        .tbl th { text-align: left; font-weight: 700; }
        .tbl-vans thead th { background: #e0e7ff; }
        .tbl-rows thead th { background: #ffedd5; }
        .tbl tbody tr:nth-child(odd) { background: rgba(255,255,255,.6); }
        .tbl tbody tr:nth-child(even){ background: rgba(255,255,255,.85); }

        /* --- Inputs & boutons --- */
        .td-in { width: 100%; padding: 4px 6px; box-sizing: border-box; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; }
        .btn-xs { padding: 4px 8px; font-size: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f8fafc; cursor: pointer; }
        .btn-sm { padding: 6px 10px; font-size: 12px; border-radius: 10px; border: 1px solid #c7d2fe; background: #e0e7ff; cursor: pointer; }
        .btn-sm:disabled, .btn-xs:disabled { opacity: .6; cursor: not-allowed; }

        .btn-calc {
          font-weight: 800; font-size: 18px; padding: 12px 28px; border-radius: 12px;
          border: 1px solid #1d4ed8; background: #2563eb; color: #fff; cursor: pointer;
          box-shadow: 0 6px 18px rgba(37,99,235,.25);
        }
        .btn-calc:disabled { background: #cbd5e1; border-color: #94a3b8; cursor: not-allowed; }

        /* --- Résultats --- */
        .resum { margin-top: 4px; font-size: 13px; }
        .van-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #fff; }
        .van-title { font-weight: 800; margin-bottom: 8px; font-size: 16px; }
        .van-weight { margin-bottom: 8px; font-size: 12px; opacity: .9; }

        /* Inputs "Coût" en jaune */
        .td-cost { background: #FEF9C3; }           /* amber-100 */
        .td-cost:disabled { background: #FEF9C3; opacity: .85; }
      `}</style>

      {/* Messages système (facultatif) */}
      {loadingFb && <div style={{opacity:.7, fontSize:12, marginTop:8, textAlign:"center"}}>Chargement…</div>}
      {msg && <div style={{fontSize:12, marginTop:4, color:"#b45309", textAlign:"center"}}>{msg}</div>}
    </div>
  );
}

const tdInput = { padding: "4px 6px", fontSize: 12 };
