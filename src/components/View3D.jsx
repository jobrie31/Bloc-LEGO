import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useMemo } from "react";

/**
 * Vue 3D de la vanne et des blocs placés + légende isométrique.
 * Axes (monde 3D) : X = longueur (L), Y = hauteur (H), Z = largeur (l)
 * Unités : pouces
 */
export default function View3D({ van, colorMap, height = 420, legendPreset = "normal" }) {
  const { l = 0, w = 0, h = 0, placed = [] } = van || {};

  const compact = legendPreset === "compact";
  const tiny = legendPreset === "tiny";

  // --------- Caméra : distance sûre pour éviter le zoom trop proche
  const diag = Math.sqrt(l * l + w * w + h * h) || 1;
  const maxDim = Math.max(l || 1, w || 1, h || 1);
  const camDist = Math.max(diag * 1.8, maxDim * 2.4);
  const camera = {
    position: [maxDim * 0.9 || 1, maxDim * 1.2 || 1, maxDim * 1.0 || 1],
    near: 0.1,
    far: Math.max(5000, camDist * 4),
    fov: 45,
  };
  const target = [l / 2, h / 2, w / 2];

  // --------- Items → 3D (X=L, Y=H, Z=l)
  const items = useMemo(
    () =>
      (placed || []).map((b, idx) => {
        const size = [b.l, b.h, b.w]; // X,Y,Z
        const pos = [b.x + b.l / 2, b.z + b.h / 2, b.y + b.w / 2];
        const color =
          (colorMap && colorMap[b.type]) ||
          DEFAULT_COLORS[hashStr(b.type) % DEFAULT_COLORS.length];
        return {
          key: `${b.type}-${idx}`,
          size,
          pos,
          color,
          type: b.type,
          L: b.l,
          W: b.w,
          H: b.h,
        };
      }),
    [placed, colorMap]
  );

  // --------- Légende : 1 entrée par type (premier bloc de chaque type)
  const legend = useMemo(() => {
    const firstByType = new Map();
    for (const it of items) {
      if (it.type && !firstByType.has(it.type)) firstByType.set(it.type, it);
    }
    const arr = [...firstByType.entries()].map(([type, it]) => ({
      type: String(type),
      color: it.color,
      L: it.L,
      W: it.W,
      H: it.H,
    }));
    arr.sort((a, b) => a.type.localeCompare(b.type));
    return arr;
  }, [items]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <Canvas camera={camera}>
        {/* Lumière */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[1000, 1000, 600]} intensity={0.85} />

        {/* Vanne translucide */}
        <group>
          <mesh position={[l / 2, h / 2, w / 2]}>
            <boxGeometry args={[l || 1, h || 1, w || 1]} />
            <meshPhysicalMaterial
              color="#93c5fd"
              transparent
              opacity={0.07}
              roughness={0.9}
              metalness={0}
            />
            <Edges />
          </mesh>

          {/* Moulures (blocs) */}
          {items.map((it) => (
            <mesh key={it.key} position={it.pos}>
              <boxGeometry args={it.size} />
              <meshStandardMaterial color={it.color} />
              <Edges />
            </mesh>
          ))}
        </group>

        {/* Repère + contrôles */}
        <axesHelper args={[Math.max(l, w, h) * 0.6 || 100]} />
        <OrbitControls
          makeDefault
          target={target}
          enablePan
          minDistance={maxDim * 0.6}
          maxDistance={Math.max(camDist * 2, maxDim * 6)}
        />
      </Canvas>

      {/* Légende */}
      {legend.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: tiny ? 6 : 10,
            right: tiny ? 6 : 10,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid #e5e7eb",
            borderRadius: tiny ? 8 : 10,
            padding: tiny ? "4px 6px" : compact ? "6px 8px" : "10px 12px",
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: tiny ? 9 : compact ? 10 : 12,
            maxHeight: "70%",
            overflow: "auto",
            boxShadow: "0 6px 16px rgba(0,0,0,0.07)",
            backdropFilter: "saturate(1.1) blur(2px)",
            minWidth: tiny ? 110 : compact ? 130 : 170,
          }}
        >
          {/* ✅ enlever "(moulures)" en snapshot (compact/tiny) */}
          <div style={{ fontWeight: 800, marginBottom: tiny ? 4 : compact ? 6 : 8 }}>
            {compact || tiny ? "Légende" : "Légende (moulures)"}
          </div>

          <div style={{ display: "grid", gap: tiny ? 4 : compact ? 6 : 10 }}>
            {legend.map((e) => (
              <LegendRow key={e.type} entry={e} compact={compact} tiny={tiny} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Légende : une ligne avec mini prisme SVG + type + valeurs ---------- */

function LegendRow({ entry, compact, tiny }) {
  const { type, color, L = 0, W = 0, H = 0 } = entry;

  const prismW = tiny ? 34 : compact ? 44 : 56;
  const prismH = tiny ? 24 : compact ? 32 : 42;

  return (
    <div
      title={type}
      style={{
        display: "grid",
        gridTemplateColumns: `${prismW}px 1fr`,
        alignItems: "center",
        gap: tiny ? 6 : compact ? 8 : 10,
      }}
    >
      <MiniIsoPrism
        L={L}
        W={W}
        H={H}
        color={color}
        width={prismW}
        height={prismH}
        labelFont={tiny ? 6 : compact ? 7 : 8}
        arrowHead={tiny ? 3 : compact ? 4 : 5}
      />

      <div style={{ display: "grid", gap: 1 }}>
        <div style={{ fontWeight: 600, fontSize: tiny ? 9 : compact ? 10 : 12, lineHeight: 1.1 }}>
          {type}
        </div>
        <div style={{ opacity: 0.75, fontSize: tiny ? 8 : compact ? 9 : 11, lineHeight: 1.1 }}>
          L={fmt(L)}″ • H={fmt(H)}″
        </div>
      </div>
    </div>
  );
}

/* ---------- Mini prisme isométrique en SVG, avec flèches L et H ---------- */

function MiniIsoPrism({
  L = 1,
  W = 1,
  H = 1,
  color = "#777",
  width = 56,
  height = 42,
  labelFont = 8,
  arrowHead = 5,
}) {
  // Projection isométrique simple
  const iso = (x, y, z) => {
    const sx = (x - z) * 0.8660254; // cos(30°)
    const sy = y + (x + z) * 0.5; // sin(30°)
    return [sx, sy];
  };

  // Coins 3D
  const P = {
    A: [0, 0, 0],
    B: [L, 0, 0],
    C: [L, 0, W],
    D: [0, 0, W],
    E: [0, H, 0],
    F: [L, H, 0],
    G: [L, H, W],
    Hh: [0, H, W],
  };

  // Projete tous les points
  const pts = Object.fromEntries(
    Object.entries(P).map(([k, v]) => [k, iso(v[0], v[1], v[2])])
  );

  // Box projetée → fit dans width×height
  const allX = Object.values(pts).map((p) => p[0]);
  const allY = Object.values(pts).map((p) => p[1]);
  const minX = Math.min(...allX),
    maxX = Math.max(...allX);
  const minY = Math.min(...allY),
    maxY = Math.max(...allY);
  const w0 = maxX - minX || 1,
    h0 = maxY - minY || 1;
  const pad = 3;
  const targetW = width - pad * 2;
  const targetH = height - pad * 2;
  const scale = Math.min(targetW / w0, targetH / h0);
  const ox = pad - minX * scale + (targetW - w0 * scale) / 2;
  const oy = pad - minY * scale + (targetH - h0 * scale) / 2;

  // helper
  const M = ([x, y]) => [x * scale + ox, y * scale + oy];

  // Faces (ordre: top, droite, gauche)
  const top = [M(pts.E), M(pts.F), M(pts.G), M(pts.Hh)];
  const right = [M(pts.B), M(pts.C), M(pts.G), M(pts.F)];
  const left = [M(pts.A), M(pts.D), M(pts.Hh), M(pts.E)];

  // flèches: L sur l’arête EF (haut), H sur l’arête AE (verticale gauche)
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const EF = [M(pts.E), M(pts.F)];
  const AE = [M(pts.A), M(pts.E)];

  const [EFmX, EFmY] = mid(EF[0], EF[1]);
  const [AEmX, AEmY] = mid(AE[0], AE[1]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} rx="6" ry="6" fill="transparent" />

      {/* faces */}
      <polygon points={poly(left)} fill={shade(color, -18)} stroke="#00000020" />
      <polygon points={poly(right)} fill={shade(color, -8)} stroke="#00000020" />
      <polygon points={poly(top)} fill={shade(color, 0)} stroke="#00000020" />

      {/* flèche L (EF) */}
      <Arrow x1={EF[0][0]} y1={EF[0][1]} x2={EF[1][0]} y2={EF[1][1]} head={arrowHead} />
      <text x={EFmX} y={EFmY - 2} textAnchor="middle" fontSize={labelFont} fill="#111">
        L
      </text>

      {/* flèche H (AE) */}
      <Arrow x1={AE[0][0]} y1={AE[0][1]} x2={AE[1][0]} y2={AE[1][1]} head={arrowHead} />
      <text x={AEmX - 4} y={AEmY} textAnchor="end" fontSize={labelFont} fill="#111">
        H
      </text>
    </svg>
  );
}

function Arrow({ x1, y1, x2, y2, head = 5 }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const a = head;
  const backX = x2 - ux * a;
  const backY = y2 - uy * a;
  const leftX = backX + -uy * (a * 0.6);
  const leftY = backY + ux * (a * 0.6);
  const rightX = backX - -uy * (a * 0.6);
  const rightY = backY - ux * (a * 0.6);

  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth="1" />
      <polygon points={`${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`} fill="#374151" />
    </>
  );
}

/* ---------- Utils ---------- */

const DEFAULT_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b",
  "#9333ea", "#0ea5e9", "#ef4444", "#10b981",
  "#f97316", "#a855f7", "#14b8a6", "#e11d48",
];

function hashStr(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function poly(arr) {
  return arr.map(([x, y]) => `${x},${y}`).join(" ");
}

function shade(hex, amount = 0) {
  try {
    const c = hex.replace("#", "");
    const n = parseInt(c, 16);
    let r = ((n >> 16) & 255) + amount;
    let g = ((n >> 8) & 255) + amount;
    let b = (n & 255) + amount;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v : v.toFixed(0);
}
