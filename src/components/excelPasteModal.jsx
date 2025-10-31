import React, { useState } from "react";

/**
 * ExcelPasteModal — Coller depuis Excel/Google Sheets
 *
 * Props:
 *  - open: bool
 *  - onClose: fn()
 *  - onImport: fn(rows: {id,l,h,wt}[])
 */
export default function ExcelPasteModal({ open, onClose, onImport }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const parse = () => {
    setError("");
    try {
      const rows = parseTSV(text);
      if (!rows.length) throw new Error("Aucune donnée détectée.");
      onImport?.(rows);
      onClose?.();
      setText("");
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
          Coller depuis Excel / Google Sheets
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Formats acceptés (sans entêtes) :
          <ul style={{ margin: "6px 0 0 16px" }}>
            <li><code>L | H</code></li>
            <li><code>ID | L | H</code></li>
            <li><code>ID | L | H | poids</code></li>
          </ul>
          Entêtes reconnues (fr/en) : <code>id, longueur/L, hauteur/H, poids/weight/wt</code>
        </div>
        <textarea
          autoFocus
          placeholder="Colle ici (Ctrl/Cmd+V)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={styles.ta}
        />
        {error && (
          <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={parse}><b>Importer</b></button>
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers parsing ----------

function parseTSV(raw) {
  if (!raw) return [];
  // Normalise \r\n et convertit CSV FR ';' -> \t
  let txt = raw.replace(/\r\n?/g, "\n");
  const looksLikeCsv = /;/.test(txt) && !/\t/.test(txt);
  if (looksLikeCsv) txt = txt.replace(/;/g, "\t");

  const lines = txt.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const cells0 = splitRow(lines[0]);
  const hasHeader = isHeaderRow(cells0);
  let start = 0;
  let headerMap;
  if (hasHeader) {
    headerMap = buildHeaderMap(cells0);
    start = 1;
  } else {
    headerMap = defaultHeaderMap(cells0.length);
  }

  const out = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (cells.length === 0) continue;
    const row = extractRow(cells, headerMap);
    if (row) out.push(row);
  }
  return out;
}

function splitRow(line) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "\t" && !inQ) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim());
}

function isHeaderRow(cells) {
  const joined = cells.join(" ").toLowerCase();
  const keys = ["id","longueur","length"," l","l ","hauteur","height"," h","h ","poids","weight","wt"];
  return keys.some((k) => joined.includes(k));
}

function defaultHeaderMap(len) {
  // Sans entêtes → déduire :
  // 2:  L | H
  // 3:  ID | L | H
  // 4+: ID | L | H | WT
  if (len <= 2) return { id: -1, l: 0, h: 1, wt: -1 };
  if (len === 3) return { id: 0, l: 1, h: 2, wt: -1 };
  return { id: 0, l: 1, h: 2, wt: 3 };
}

function buildHeaderMap(cells) {
  const idx = { id: -1, l: -1, h: -1, wt: -1 };
  cells.forEach((c, i) => {
    const k = norm(c);
    if (["id", "code", "type", "moulure"].includes(k)) idx.id = i;
    else if (["l", "longueur", "length", "x"].includes(k)) idx.l = i;
    else if (["h", "hauteur", "height", "z"].includes(k)) idx.h = i;
    else if (["poids", "weight", "wt", "kg", "lb"].includes(k)) idx.wt = i;
  });
  const base = defaultHeaderMap(cells.length);
  return {
    id: idx.id >= 0 ? idx.id : base.id,
    l:  idx.l  >= 0 ? idx.l  : base.l,
    h:  idx.h  >= 0 ? idx.h  : base.h,
    wt: idx.wt >= 0 ? idx.wt : base.wt,
  };
}

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function toNum(x) {
  if (x === null || x === undefined) return 0;
  const s = String(x).replace(/,/, ".").replace(/[^0-9.+-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function extractRow(cells, map) {
  const safe = (i) => (i >= 0 && i < cells.length ? cells[i] : "");
  const id = String(safe(map.id)).trim();
  const l = toNum(safe(map.l));
  const h = toNum(safe(map.h));
  const wt = toNum(safe(map.wt));
  if (!id && !(l && h)) return null; // ligne vide
  return { id, l, h, wt };
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.25)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    width: 600,
    maxWidth: "95vw",
    boxShadow: "0 20px 50px rgba(0,0,0,.15)",
  },
  ta: {
    width: "100%",
    height: 220,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    padding: 8,
  },
};
