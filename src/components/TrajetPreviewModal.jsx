import React, { useEffect, useMemo } from "react";
import View3D from "./View3D";

export default function TrajetPreviewModal({ open, trajet, onClose }) {
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const { title, createdAt, context = {}, result = {} } = trajet || {};

  const vansSnapshot = context.vansSnapshot || [];
  const rowsSnapshot = context.rowsSnapshot || [];
  const resultVans = Array.isArray(result.vans) ? result.vans : [];
  const billing = result.billing || {};

  // 1) Date sans heure
  const dateOnly = useMemo(() => {
    try {
      if (createdAt && typeof createdAt === "object" && Number.isFinite(createdAt.seconds)) {
        return new Date(createdAt.seconds * 1000).toLocaleDateString();
      }
      if (typeof createdAt === "string") {
        return new Date(createdAt).toLocaleDateString();
      }
    } catch {}
    return "—";
  }, [createdAt]);

  // 2) Compteur d’utilisation par clé (group ou name)
  const usageByKey = useMemo(() => {
    const m = new Map();
    for (const v of resultVans) {
      const key = (String(v.group || v.name || "").trim()) || `__solo_${v.code || ""}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [resultVans]);

  // ✅ Vans à afficher dans le snapshot = seulement celles cochées lors du test
  // - si le snapshot contient un champ de coche (checked/isChecked/selected/...)
  //   => on filtre sur ce champ
  // - sinon (on ne peut pas savoir lesquelles étaient cochées)
  //   => fallback: on montre seulement celles utilisées dans le résultat
  const visibleVansSnapshot = useMemo(() => {
    const CHECK_KEYS = ["checked", "isChecked", "selected", "enabled", "useInTest", "include"];

    const hasAnyCheckField = vansSnapshot.some((v) => CHECK_KEYS.some((k) => v && k in v));

    const isChecked = (v) => {
      const val =
        v?.checked ??
        v?.isChecked ??
        v?.selected ??
        v?.enabled ??
        v?.useInTest ??
        v?.include;
      return val === true || val === 1 || val === "true" || val === "1";
    };

    if (hasAnyCheckField) return vansSnapshot.filter(isChecked);

    // fallback: seulement celles utilisées
    return vansSnapshot.filter((v) => {
      const key = String(v?.group || v?.name || "").trim() || "";
      return (usageByKey.get(key) || 0) > 0;
    });
  }, [vansSnapshot, usageByKey]);

  // 3) Chiffres de la bulle du haut
  const topBubble = useMemo(() => {
    const totalCost = Number(billing.totalCost || 0);
    const totalVans = resultVans.length;
    const bundlesCount = rowsSnapshot.length;
    return { totalCost, totalVans, bundlesCount };
  }, [billing, resultVans, rowsSnapshot]);

  if (!open) return null;

  return (
    <div
      className="tp-backdrop"
      onClick={(e) => {
        if (e.target.classList.contains("tp-backdrop")) onClose?.();
      }}
    >
      <div className="tp-modal">
        <div className="tp-header">
          <div className="tp-title">
            {title || "Trajet"} — {dateOnly}
          </div>
          <button className="tp-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Bulle du haut */}
        <div className="tp-top-bubble">
          <div className="tp-bubble-item">
            <div className="tp-bubble-label">Coût total</div>
            <div className="tp-bubble-value">{topBubble.totalCost.toLocaleString()}</div>
          </div>
          <div className="tp-bubble-item">
            <div className="tp-bubble-label">Vans</div>
            <div className="tp-bubble-value">{topBubble.totalVans}</div>
          </div>
          <div className="tp-bubble-item">
            <div className="tp-bubble-label">Bundles</div>
            <div className="tp-bubble-value">{topBubble.bundlesCount}</div>
          </div>
        </div>

        {/* Snapshots : Vans */}
        <div className="tp-section">
          <div className="tp-section-title">Vans</div>
          <div className="tp-table">
            <div className="tp-thead">
              <div className="tp-th tp-th-mult">×</div>
              <div className="tp-th">Nom</div>
              <div className="tp-th">Groupe</div>
              <div className="tp-th">L</div>
              <div className="tp-th">W</div>
              <div className="tp-th">H</div>
              <div className="tp-th">Coût</div>
              <div className="tp-th">Poids max</div>
            </div>

            <div className="tp-tbody">
              {visibleVansSnapshot.length === 0 && (
                <div className="tp-row tp-empty">Aucune van.</div>
              )}

              {visibleVansSnapshot.map((v, i) => {
                const key = String(v?.group || v?.name || "").trim() || "";
                const usedCount = usageByKey.get(key) || 0;
                const used = usedCount > 0;

                return (
                  <div key={i} className={`tp-row ${used ? "tp-row-used" : ""}`}>
                    <div className="tp-td tp-td-mult">
                      {used ? <span className="tp-mult-badge">{usedCount}X</span> : ""}
                    </div>
                    <div className="tp-td">{String(v?.name ?? "")}</div>
                    <div className="tp-td">{String(v?.group ?? "")}</div>
                    <div className="tp-td">{num(v?.l)}</div>
                    <div className="tp-td">{num(v?.w)}</div>
                    <div className="tp-td">{num(v?.h)}</div>
                    <div className="tp-td">{num(v?.cost)}</div>
                    <div className="tp-td">{num(v?.maxW)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Snapshots : Bundles */}
        <div className="tp-section">
          <div className="tp-section-title">Bundles</div>
          <div className="tp-table">
            <div className="tp-thead">
              <div className="tp-th">ID</div>
              <div className="tp-th">L</div>
              <div className="tp-th">H</div>
              <div className="tp-th">Poids</div>
            </div>
            <div className="tp-tbody">
              {rowsSnapshot.length === 0 && (
                <div className="tp-row tp-empty">Aucun bundle.</div>
              )}
              {rowsSnapshot.map((r, i) => (
                <div key={i} className="tp-row">
                  <div className="tp-td">{String(r?.id ?? "")}</div>
                  <div className="tp-td">{num(r?.l)}</div>
                  <div className="tp-td">{num(r?.h)}</div>
                  <div className="tp-td">{num(r?.wt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Résultat 3D */}
        {resultVans.length > 0 && (
          <div className="tp-section">
            <div className="tp-section-title">Vans (résultat 3D)</div>
            <div className="tp-3d-grid">
              {resultVans.map((v, idx) => {
                const label = `Van ${idx + 1} - ${String(v.name || "")}${
                  v.group ? ` (${v.group})` : ""
                }`;
                return (
                  <div key={idx} className="tp-3d-card">
                    <div className="tp-3d-title">{label}</div>
                    <div className="tp-3d-sub">
                      Poids: <b>{Number(v.weightUsed || 0).toLocaleString()}</b>
                      {v.maxWeight ? (
                        <>
                          {" "}
                          / <b>{Number(v.maxWeight).toLocaleString()}</b>
                        </>
                      ) : null}
                    </div>

                    {/* ✅ légende tiny seulement en snapshot */}
                    <View3D van={v} height={320} legendPreset="tiny" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- utils locaux -------- */
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : "";
}
