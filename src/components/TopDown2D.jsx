// src/components/TopDown2D.jsx
import { useEffect, useRef } from "react";

function colorFromType(type) {
  let hash = 0;
  for (let i = 0; i < String(type).length; i++) hash = (hash * 31 + String(type).charCodeAt(i)) | 0;
  const r = (hash & 0xff), g = ((hash >> 8) & 0xff), b = ((hash >> 16) & 0xff);
  return `rgba(${(r%200)+30}, ${(g%200)+30}, ${(b%200)+30}, 0.85)`;
}

export default function TopDown2D({ van, width = 640, height = 200, padding = 10, unitLabel = "″" }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);

    const L = van.l, W = van.w;
    const scaleX = (width - 2 * padding) / L;
    const scaleY = (height - 2 * padding) / W;

    // Cadre vanne
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding, padding, L * scaleX, W * scaleY);

    // Repère unités
    ctx.fillStyle = "#111";
    ctx.font = "11px system-ui";
    ctx.fillText(`X (″)`, padding + 4, padding - 4 + 11);
    ctx.save();
    ctx.translate(padding - 8, padding + 12);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Y (″)`, 0, 0);
    ctx.restore();

    // Blocs
    for (const b of van.placed) {
      const x = padding + b.x * scaleX;
      const y = padding + b.y * scaleY;
      const w = b.l * scaleX;
      const h = b.w * scaleY;

      ctx.fillStyle = colorFromType(b.type);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = "#000";
      ctx.font = "10px system-ui";
      ctx.fillText(b.type, x + 3, y + 12);
    }
  }, [van, width, height, padding, unitLabel]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 600 }}>
        {van.name} — {Math.round((van.fillRate || 0) * 100)}% volume
      </div>
      <canvas ref={ref} width={width} height={height} style={{ background: "#f8fafc", borderRadius: 8 }} />
      <small>Vue de dessus (X × Y) — unités : pouces (″).</small>
    </div>
  );
}
