// src/components/Ortho2D.jsx
import { useEffect, useMemo, useRef } from "react";

// Palette de secours (si aucun colorMap n'est passé)
const FALLBACK_PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b",
  "#9333ea", "#0ea5e9", "#ef4444", "#10b981",
  "#f97316", "#a855f7", "#14b8a6", "#e11d48",
];

// Couleur par type: priorité au colorMap fourni par App,
// sinon on dérive une couleur stable via FALLBACK_PALETTE.
function colorFromType(type, colorMap) {
  const t = String(type ?? "");
  if (colorMap && colorMap[t]) return colorMap[t];
  // fallback déterministe
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

function chooseStep(maxVal) {
  if (maxVal > 720) return 24; // 2 ft
  if (maxVal > 360) return 12; // 1 ft
  if (maxVal > 180) return 6;
  if (maxVal > 90)  return 3;
  if (maxVal > 45)  return 2;
  return 1;
}

function arrowHead(ctx, x, y, dx, dy, size = 8) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = (dx / len) * size, uy = (dy / len) * size;
  const px = -uy * 0.6, py = ux * 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ux + px, y - uy + py);
  ctx.lineTo(x - ux - px, y - uy - py);
  ctx.closePath();
  ctx.fill();
}
function dimArrow(ctx, x1, y1, x2, y2, label) {
  ctx.save();
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); ctx.stroke();
  arrowHead(ctx, x1, y2, 1, 0, 10);
  arrowHead(ctx, x2, y2, -1, 0, 10);
  ctx.font = "16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, (x1 + x2) / 2, y2 - 6);
  ctx.restore();
}
function dimArrowV(ctx, x1, y1, x2, y2, label) {
  ctx.save();
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); ctx.stroke();
  arrowHead(ctx, x2, y1, 0, 1, 10);
  arrowHead(ctx, x2, y2, 0, -1, 10);
  ctx.save();
  ctx.translate(x2 - 6, (y1 + y2) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawRulerAndGrid(ctx, frame, axisMax, orient, scale, opts) {
  const { gridFt = true } = opts || {};
  const { x, y, w, h } = frame;

  if (gridFt) {
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    if (orient === "horizontal") {
      const stepPx = 12 * scale;
      for (let px = x; px <= x + w + 0.5; px += stepPx) {
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
      }
    } else {
      const stepPx = 12 * scale;
      for (let py = y; py <= y + h + 0.5; py += stepPx) {
        ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
      }
    }
    ctx.restore();
  }

  const step = chooseStep(axisMax);
  const majorEvery = Math.max(1, Math.round(12 / step));
  ctx.save();
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "#111827";
  ctx.lineWidth = 1.5;

  if (orient === "horizontal") {
    const baseY = y - 24;
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x + w, baseY); ctx.stroke();
    for (let val = 0; val <= axisMax + 0.01; val += step) {
      const px = x + val * scale;
      const isMajor = Math.round(val / step) % majorEvery === 0;
      const tLen = isMajor ? 10 : 6;
      ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(px, baseY - tLen); ctx.stroke();
      if (isMajor) {
        ctx.font = "12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${val}″`, px, baseY - tLen - 2);
      }
    }
  } else {
    const baseX = x - 24;
    ctx.beginPath(); ctx.moveTo(baseX, y); ctx.lineTo(baseX, y + h); ctx.stroke();
    for (let val = 0; val <= axisMax + 0.01; val += step) {
      const py = y + val * scale;
      const isMajor = Math.round(val / step) % majorEvery === 0;
      const tLen = isMajor ? 10 : 6;
      ctx.beginPath(); ctx.moveTo(baseX, py); ctx.lineTo(baseX - tLen, py); ctx.stroke();
      if (isMajor) {
        ctx.save();
        ctx.translate(baseX - tLen - 2, py);
        ctx.rotate(-Math.PI / 2);
        ctx.font = "12px system-ui";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${val}″`, 0, 0);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

export default function Ortho2D({
  van,
  axes = ["x", "y"],
  labels = ["X (″)", "Y (″)"],
  title = "Projection",
  width = 1100,
  height = 380,
  padding = 64,
  showLegend = true,
  showDims = true,
  showGrid = true,
  colorMap = null, // <<< reçu de App
}) {
  const ref = useRef(null);

  // Légende: types uniques -> couleur (basée sur colorMap)
  const legend = useMemo(() => {
    const uniq = new Map();
    for (const b of (van?.placed || [])) {
      const col = colorFromType(b.type, colorMap);
      if (!uniq.has(b.type)) uniq.set(b.type, col);
    }
    return Array.from(uniq.entries()).map(([name, color]) => ({ name, color }));
  }, [van, colorMap]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);

    const axisSize = { x: van.l, y: van.w, z: van.h };
    const [A, B] = axes;
    const Amax = axisSize[A];
    const Bmax = axisSize[B];

    const drawableW = width - 2 * padding;
    const drawableH = height - 2 * padding;
    const scaleA = drawableW / Amax;
    const scaleB = drawableH / Bmax;

    const frame = { x: padding, y: padding, w: Amax * scaleA, h: Bmax * scaleB };

    drawRulerAndGrid(ctx, frame, Amax, "horizontal", scaleA, { gridFt: showGrid });
    drawRulerAndGrid(ctx, frame, Bmax, "vertical",   scaleB, { gridFt: showGrid });

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

    // Cotes de la vanne
    dimArrow(ctx, frame.x, frame.y - 36, frame.x + frame.w, frame.y - 8, `${labels[0].split(" ")[0]} = ${Amax}″`);
    dimArrowV(ctx, frame.x - 36, frame.y, frame.x - 8, frame.y + frame.h, `${labels[1].split(" ")[0]} = ${Bmax}″`);

    // Blocs
    for (const b of (van.placed || [])) {
      const start = (ax) => (ax === "x" ? b.x : ax === "y" ? b.y : b.z);
      const size  = (ax) => (ax === "x" ? b.l : ax === "y" ? b.w : b.h);

      const ax = frame.x + start(A) * scaleA;
      const ay = frame.y + start(B) * scaleB;
      const aw = size(A)  * scaleA;
      const ah = size(B)  * scaleB;

      ctx.fillStyle = colorFromType(b.type, colorMap);
      ctx.fillRect(ax, ay, aw, ah);

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.strokeRect(ax, ay, aw, ah);

      if (showDims) {
        ctx.fillStyle = "#111827";
        ctx.font = "13px system-ui";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${b.type} • ${size(A)}″ × ${size(B)}″`, ax + 6, ay + 6);
      }
    }

    if (showLegend) {
      ctx.save();
      ctx.font = "13px system-ui";
      ctx.fillStyle = "#111827";
      ctx.textAlign = "left";
      ctx.fillText(`Dimensions vanne (global) : L = ${van.l}″, l = ${van.w}″, H = ${van.h}″`, padding, height - 10);
      ctx.restore();
    }
  }, [van, axes, labels, width, height, padding, showLegend, showDims, showGrid, colorMap]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ background: "#fff", borderRadius: 10, border: "2px solid #cbd5e1", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
      />
      {legend.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {legend.map(({ name, color }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, background: color, border: "1px solid #1f2937", borderRadius: 3 }} />
              <small style={{ color: "#111827" }}>{name}</small>
            </div>
          ))}
        </div>
      )}
      <small>Projection : {labels[0]} × {labels[1]} — unités en pouces (″), grille 12″</small>
    </div>
  );
}
