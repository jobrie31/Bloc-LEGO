// src/components/View3D.jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useMemo } from "react";

/**
 * Vue 3D de la vanne et des blocs placés.
 * Axes (monde 3D) : X = longueur, Y = hauteur, Z = largeur
 * Unités : pouces
 */
export default function View3D({ van, colorMap, height = 420 }) {
  const { l, w, h, placed = [] } = van;

  // Camera & cible au centre de la vanne
  const diag = Math.sqrt(l * l + w * w + h * h) || 1;
  const camera = {
    position: [l * 0.8, h * 1.2, w * 1.1],
    near: 0.1,
    far: Math.max(5000, diag * 10),
    fov: 45,
  };
  const target = [l / 2, h / 2, w / 2];

  // Conversion items -> (taille, position, couleur) pour la 3D
  // (nos coordonnées internes: x=longueur, y=largeur, z=hauteur)
  // (3D: X=longueur, Y=hauteur, Z=largeur)
  const items = useMemo(
    () =>
      placed.map((b, idx) => {
        const size = [b.l, b.h, b.w]; // X,Y,Z
        const pos = [b.x + b.l / 2, b.z + b.h / 2, b.y + b.w / 2];
        const color = colorMap?.[b.type] ?? "#888888";
        return { key: `${b.id}-${idx}`, size, pos, color, type: b.type };
      }),
    [placed, colorMap]
  );

  return (
    <div style={{ width: "100%", height }}>
      <Canvas camera={camera}>
        {/* Lumière */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[1000, 1000, 500]} intensity={0.8} />

        {/* Vanne (boîte translucide + arêtes) */}
        <group>
          <mesh position={[l / 2, h / 2, w / 2]}>
            <boxGeometry args={[l, h, w]} />
            <meshPhysicalMaterial
              color="#93c5fd"
              transparent
              opacity={0.07}
              roughness={0.9}
              metalness={0}
            />
            <Edges />
          </mesh>

          {/* Blocs (moulures) */}
          {items.map((it) => (
            <mesh key={it.key} position={it.pos}>
              <boxGeometry args={it.size} />
              <meshStandardMaterial color={it.color} />
              <Edges />
            </mesh>
          ))}
        </group>

        {/* Axes et contrôle caméra */}
        <axesHelper args={[Math.max(l, w, h) * 0.6]} />
        <OrbitControls makeDefault target={target} enablePan={true} />
      </Canvas>
    </div>
  );
}
