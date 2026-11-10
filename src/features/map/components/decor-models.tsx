"use client";

import * as THREE from "three";
import type { DecorKind } from "../model/map-document";

/**
 * Furniture and village dressing drawn from primitives (low-poly, matching the
 * doors and braziers). Every model fits one square and faces south (+z) at
 * rotation 0.
 */

const WOOD = "#8a5a32";
const WOOD_LIGHT = "#a87445";
const WOOD_DARK = "#4a3020";
const IRON = "#3b3f46";
const GOLD = "#d4a017";
const STONE = "#8d8a84";
const STONE_DARK = "#66635e";
const CLOTH_RED = "#9b2335";
const CLOTH_WHITE = "#e8e2d4";
const STRAW = "#d9b54a";

function M({ color, metal, emissive }: { color: string; metal?: boolean; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={metal ? 0.45 : 0.85} metalness={metal ? 0.6 : 0} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.8 : 0} />;
}

type V3 = [number, number, number];

function Box({ size, at, color, metal, rot }: { size: V3; at: V3; color: string; metal?: boolean; rot?: V3 }) {
  return (
    <mesh castShadow receiveShadow position={at} rotation={rot}>
      <boxGeometry args={size} />
      <M color={color} metal={metal} />
    </mesh>
  );
}

function Cyl({ r, h, at, color, metal, top, seg = 12, rot }: { r: number; h: number; at: V3; color: string; metal?: boolean; top?: number; seg?: number; rot?: V3 }) {
  return (
    <mesh castShadow receiveShadow position={at} rotation={rot}>
      <cylinderGeometry args={[top ?? r, r, h, seg]} />
      <M color={color} metal={metal} />
    </mesh>
  );
}

/** Four legs under a top of the given half-extents. */
function Legs({ hx, hz, h, w = 0.05, color = WOOD_DARK }: { hx: number; hz: number; h: number; w?: number; color?: string }) {
  return (
    <>
      {[
        [-hx, -hz],
        [hx, -hz],
        [-hx, hz],
        [hx, hz],
      ].map(([x, z]) => (
        <Box key={`${x},${z}`} size={[w, h, w]} at={[x, h / 2, z]} color={color} />
      ))}
    </>
  );
}

function Barrel() {
  return (
    <group>
      <Cyl r={0.2} top={0.2} h={0.52} at={[0, 0.26, 0]} color={WOOD} seg={14} />
      <Cyl r={0.235} h={0.18} at={[0, 0.26, 0]} color={WOOD_LIGHT} seg={14} />
      {[0.08, 0.44].map((y) => (
        <Cyl key={y} r={0.215} h={0.035} at={[0, y, 0]} color={IRON} metal seg={14} />
      ))}
      <Cyl r={0.19} h={0.01} at={[0, 0.525, 0]} color={WOOD_DARK} seg={14} />
    </group>
  );
}

function Crate() {
  return (
    <group>
      <Box size={[0.5, 0.5, 0.5]} at={[0, 0.25, 0]} color={WOOD_LIGHT} />
      {[-0.26, 0.26].map((z) => (
        <Box key={z} size={[0.52, 0.06, 0.02]} at={[0, 0.25, z]} color={WOOD_DARK} rot={[0, 0, Math.PI / 4]} />
      ))}
      <Box size={[0.52, 0.04, 0.52]} at={[0, 0.5, 0]} color={WOOD} />
    </group>
  );
}

function Chest() {
  return (
    <group>
      <Box size={[0.6, 0.3, 0.38]} at={[0, 0.15, 0]} color={WOOD} />
      <mesh castShadow position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.6, 12, 1, false, 0, Math.PI]} />
        <M color={WOOD_LIGHT} />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <Box key={x} size={[0.05, 0.32, 0.4]} at={[x, 0.16, 0]} color={IRON} metal />
      ))}
      <Box size={[0.08, 0.1, 0.03]} at={[0, 0.27, 0.2]} color={GOLD} metal />
    </group>
  );
}

function Table() {
  return (
    <group>
      <Box size={[0.82, 0.06, 0.7]} at={[0, 0.48, 0]} color={WOOD_LIGHT} />
      <Legs hx={0.34} hz={0.28} h={0.45} w={0.06} />
      <Cyl r={0.05} top={0.04} h={0.1} at={[0.15, 0.56, 0.1]} color="#b9b2a2" />
      <Cyl r={0.08} h={0.02} at={[-0.15, 0.52, -0.08]} color="#c9c1ad" seg={16} />
    </group>
  );
}

function Chair() {
  return (
    <group>
      <Box size={[0.34, 0.05, 0.34]} at={[0, 0.27, 0]} color={WOOD_LIGHT} />
      <Legs hx={0.14} hz={0.14} h={0.25} w={0.04} />
      <Box size={[0.34, 0.38, 0.05]} at={[0, 0.48, -0.15]} color={WOOD} />
    </group>
  );
}

function Bench() {
  return (
    <group>
      <Box size={[0.9, 0.06, 0.26]} at={[0, 0.27, 0]} color={WOOD_LIGHT} />
      {[-0.36, 0.36].map((x) => (
        <Box key={x} size={[0.06, 0.25, 0.22]} at={[x, 0.125, 0]} color={WOOD_DARK} />
      ))}
    </group>
  );
}

function Bed() {
  return (
    <group>
      <Box size={[0.56, 0.18, 0.9]} at={[0, 0.15, 0]} color={WOOD} />
      <Box size={[0.5, 0.1, 0.84]} at={[0, 0.28, 0]} color={CLOTH_WHITE} />
      <Box size={[0.52, 0.11, 0.5]} at={[0, 0.3, 0.18]} color={CLOTH_RED} />
      <Box size={[0.36, 0.08, 0.16]} at={[0, 0.36, -0.32]} color="#f4f0e6" />
      <Box size={[0.58, 0.55, 0.06]} at={[0, 0.27, -0.45]} color={WOOD_DARK} />
    </group>
  );
}

const BOOK_COLORS = ["#7c2d12", "#1e3a8a", "#14532d", "#713f12", "#581c87", "#9a3412"];

function Bookshelf() {
  return (
    <group>
      <Box size={[0.9, 1.2, 0.08]} at={[0, 0.6, -0.16]} color={WOOD_DARK} />
      {[-0.43, 0.43].map((x) => (
        <Box key={x} size={[0.05, 1.2, 0.36]} at={[x, 0.6, 0]} color={WOOD_DARK} />
      ))}
      {[0.03, 0.4, 0.78, 1.17].map((y) => (
        <Box key={y} size={[0.86, 0.04, 0.36]} at={[0, y, 0]} color={WOOD} />
      ))}
      {[0.05, 0.42, 0.8].flatMap((shelf, s) =>
        Array.from({ length: 7 }, (_, b) => {
          const h = 0.24 + ((b * 7 + s * 3) % 5) * 0.025;
          return <Box key={`${s}-${b}`} size={[0.09, h, 0.24]} at={[-0.33 + b * 0.11, shelf + h / 2 + 0.02, 0.02]} color={BOOK_COLORS[(b + s * 2) % BOOK_COLORS.length]} />;
        }),
      )}
    </group>
  );
}

function Counter() {
  return (
    <group>
      <Box size={[0.98, 0.52, 0.44]} at={[0, 0.26, 0]} color={WOOD} />
      <Box size={[1, 0.06, 0.5]} at={[0, 0.55, 0]} color={WOOD_DARK} />
      <Cyl r={0.05} top={0.06} h={0.14} at={[-0.25, 0.65, 0]} color="#9ca3af" />
      <Cyl r={0.05} top={0.06} h={0.14} at={[0.2, 0.65, 0.05]} color="#9ca3af" />
    </group>
  );
}

function Throne() {
  return (
    <group>
      <Box size={[0.9, 0.12, 0.8]} at={[0, 0.06, 0]} color={STONE_DARK} />
      <Box size={[0.6, 0.38, 0.5]} at={[0, 0.31, 0]} color={GOLD} metal />
      <Box size={[0.5, 0.08, 0.44]} at={[0, 0.54, 0.02]} color={CLOTH_RED} />
      <Box size={[0.62, 1.05, 0.12]} at={[0, 0.85, -0.22]} color={GOLD} metal />
      <Box size={[0.46, 0.75, 0.04]} at={[0, 0.85, -0.15]} color={CLOTH_RED} />
      {[-0.29, 0.29].map((x) => (
        <Box key={x} size={[0.08, 0.2, 0.46]} at={[x, 0.6, 0]} color={GOLD} metal />
      ))}
      <mesh castShadow position={[0, 1.46, -0.22]}>
        <octahedronGeometry args={[0.09]} />
        <meshStandardMaterial color="#60a5fa" emissive="#2563eb" emissiveIntensity={0.6} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Altar() {
  return (
    <group>
      <Box size={[0.86, 0.12, 0.56]} at={[0, 0.06, 0]} color={STONE_DARK} />
      <Box size={[0.76, 0.46, 0.46]} at={[0, 0.35, 0]} color={STONE} />
      <Box size={[0.3, 0.47, 0.47]} at={[0, 0.35, 0.005]} color={CLOTH_RED} />
      <Box size={[0.8, 0.05, 0.5]} at={[0, 0.6, 0]} color={STONE} />
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 0.63, 0]}>
          <Cyl r={0.03} h={0.14} at={[0, 0.07, 0]} color="#f5f0dc" />
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.025, 0.06, 8]} />
            <meshBasicMaterial color="#ffc46b" />
          </mesh>
        </group>
      ))}
      <Box size={[0.2, 0.06, 0.14]} at={[0, 0.65, 0]} color={GOLD} metal />
    </group>
  );
}

function Well() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.4, 0.42, 0.48, 16, 1, true]} />
        <meshStandardMaterial color={STONE} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <torusGeometry args={[0.4, 0.05, 6, 18]} />
        <M color={STONE_DARK} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, 0]}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial color="#1e3a4a" roughness={0.2} />
      </mesh>
      {[-0.36, 0.36].map((x) => (
        <Box key={x} size={[0.06, 0.8, 0.06]} at={[x, 0.65, 0]} color={WOOD_DARK} />
      ))}
      <Cyl r={0.035} h={0.76} at={[0, 0.88, 0]} rot={[0, 0, Math.PI / 2]} color={WOOD} />
      <mesh castShadow position={[0, 1.13, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[0.62, 0.32, 4]} />
        <M color="#7c3f22" />
      </mesh>
      <Cyl r={0.07} top={0.08} h={0.12} at={[0.08, 0.68, 0]} color={WOOD} />
    </group>
  );
}

function Stall() {
  return (
    <group>
      <Box size={[0.9, 0.44, 0.4]} at={[0, 0.22, 0.12]} color={WOOD} />
      {[
        [-0.42, 0.3],
        [0.42, 0.3],
        [-0.42, -0.3],
        [0.42, -0.3],
      ].map(([x, z]) => (
        <Box key={`${x},${z}`} size={[0.05, z > 0 ? 0.95 : 1.15, 0.05]} at={[x, z > 0 ? 0.475 : 0.575, z]} color={WOOD_DARK} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} size={[0.19, 0.03, 0.72]} at={[-0.38 + i * 0.19, 1.07, 0]} rot={[0.28, 0, 0]} color={i % 2 ? CLOTH_WHITE : "#b91c1c"} />
      ))}
      {[
        ["#ef4444", -0.25],
        ["#f59e0b", -0.05],
        ["#84cc16", 0.15],
        ["#ef4444", 0.32],
      ].map(([c, x]) => (
        <mesh key={x as number} castShadow position={[x as number, 0.5, 0.14]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <M color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

function Banner() {
  return (
    <group>
      <Cyl r={0.08} top={0.06} h={0.08} at={[0, 0.04, 0]} color={STONE_DARK} />
      <Cyl r={0.025} h={1.55} at={[0, 0.78, 0]} color={WOOD_DARK} />
      <Cyl r={0.018} h={0.5} at={[0, 1.48, 0.0]} rot={[0, 0, Math.PI / 2]} color={WOOD_DARK} />
      <Box size={[0.44, 0.75, 0.02]} at={[0, 1.08, 0.03]} color={CLOTH_RED} />
      <mesh position={[0, 1.12, 0.045]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.14, 0.14, 0.01]} />
        <M color={GOLD} metal />
      </mesh>
      <mesh castShadow position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <M color={GOLD} metal />
      </mesh>
    </group>
  );
}

function Anvil() {
  return (
    <group>
      <Cyl r={0.2} top={0.18} h={0.3} at={[0, 0.15, 0]} color={WOOD_DARK} seg={10} />
      <Box size={[0.16, 0.12, 0.14]} at={[0, 0.36, 0]} color={IRON} metal />
      <Box size={[0.42, 0.1, 0.18]} at={[0.02, 0.46, 0]} color={IRON} metal />
      <mesh castShadow position={[-0.24, 0.47, 0]} rotation-z={Math.PI / 2}>
        <coneGeometry args={[0.06, 0.14, 8]} />
        <M color={IRON} metal />
      </mesh>
    </group>
  );
}

function Haystack() {
  return (
    <group>
      <Cyl r={0.42} top={0.36} h={0.36} at={[0, 0.18, 0]} color={STRAW} seg={14} />
      <mesh castShadow position={[0, 0.36, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <M color="#e2c35a" />
      </mesh>
    </group>
  );
}

function Cart() {
  return (
    <group>
      <Box size={[0.5, 0.06, 0.82]} at={[0, 0.34, 0]} color={WOOD_LIGHT} />
      {[-0.25, 0.25].map((x) => (
        <Box key={x} size={[0.04, 0.2, 0.82]} at={[x, 0.46, 0]} color={WOOD} />
      ))}
      <Box size={[0.5, 0.2, 0.04]} at={[0, 0.46, -0.4]} color={WOOD} />
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} castShadow position={[x, 0.24, 0.05]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.22, 0.22, 0.05, 14]} />
          <M color={WOOD_DARK} />
        </mesh>
      ))}
      {[-0.12, 0.12].map((x) => (
        <Box key={x} size={[0.04, 0.04, 0.5]} at={[x, 0.32, 0.6]} color={WOOD_DARK} rot={[0.25, 0, 0]} />
      ))}
      <Box size={[0.3, 0.16, 0.3]} at={[0.04, 0.45, 0.1]} color={STRAW} />
    </group>
  );
}

/** One side of a square: posts on the corners and the middle of the line, two rails between them. */
function FenceSide() {
  return (
    <group position={[0, 0, 0.5]}>
      {[-0.5, 0, 0.5].map((x) => (
        <Box key={x} size={[0.07, 0.6, 0.07]} at={[x, 0.3, 0]} color={WOOD_DARK} />
      ))}
      {[0.22, 0.46].map((y) => (
        <Box key={y} size={[1, 0.06, 0.035]} at={[0, y, 0]} color={WOOD_LIGHT} />
      ))}
    </group>
  );
}

/** Fence on the south line of its square. */
function Fence() {
  return <FenceSide />;
}

/** Fence on the south and east lines, meeting at the corner. */
function FenceCorner() {
  return (
    <group>
      <FenceSide />
      <group rotation-y={Math.PI / 2}>
        <FenceSide />
      </group>
    </group>
  );
}

const MODELS: Record<DecorKind, () => React.JSX.Element> = {
  fence: Fence,
  "fence-corner": FenceCorner,
  barrel: Barrel,
  crate: Crate,
  chest: Chest,
  table: Table,
  chair: Chair,
  bench: Bench,
  bed: Bed,
  bookshelf: Bookshelf,
  counter: Counter,
  throne: Throne,
  altar: Altar,
  well: Well,
  stall: Stall,
  banner: Banner,
  anvil: Anvil,
  haystack: Haystack,
  cart: Cart,
};

export function DecorModel({ kind }: { kind: DecorKind }) {
  const Model = MODELS[kind];
  return <Model />;
}
