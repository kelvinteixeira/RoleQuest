"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Clone, Html, MapControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  cellIndex,
  cellNoise,
  doorOf,
  lightOf,
  PROP_BY_ID,
  PROPS,
  TERRAINS,
  trapOf,
  type Ambient,
  type MapDocument,
  type MapNote,
  type PlacedProp,
} from "../model/map-document";
import type { Cell } from "../model/shapes";
import { LIGHT_POOL, pickLights, type LightSpot } from "../model/lights";

export type { LightSpot } from "../model/lights";
import { backgroundPlane } from "../model/background";
import { useMapImage } from "../hooks/use-map-image";

/* ---------- World geometry ---------- */

export const LEVEL = 0.4;
export const WATER_LINE = -0.08;
const BASE_Y = -0.9;
const RAISED_HEIGHT = 1.15;
const TOP_THICKNESS = 0.06;

export function cellToWorld(doc: Pick<MapDocument, "cols" | "rows">, x: number, y: number): [number, number] {
  return [x - doc.cols / 2 + 0.5, y - doc.rows / 2 + 0.5];
}

/** Height of the walkable/visible top of a cell. */
export function cellTop(doc: MapDocument, x: number, y: number): number {
  const i = cellIndex(doc, x, y);
  const def = TERRAINS[doc.terrain[i]];
  const level = doc.elevation[i] * LEVEL;
  if (def.kind === "water") return WATER_LINE - (def.depth ?? 0.2);
  if (def.kind === "raised") return level + RAISED_HEIGHT + cellNoise(x, y, 5) * 0.3;
  return level;
}

/** Where a token or prop stands: the water surface for water cells. */
export function cellStandY(doc: MapDocument, x: number, y: number): number {
  const def = TERRAINS[doc.terrain[cellIndex(doc, x, y)]];
  return def.kind === "water" ? WATER_LINE : cellTop(doc, x, y);
}

/* ---------- Terrain ---------- */

const box = new THREE.BoxGeometry(1, 1, 1);
const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

function jitter(hex: string, x: number, y: number, amount = 0.07) {
  tmpColor.set(hex);
  const n = (cellNoise(x, y, 1) - 0.5) * 2 * amount;
  return tmpColor.offsetHSL(0, 0, n);
}

export type CellPointerHandler = (cell: Cell, event: ThreeEvent<PointerEvent>) => void;

function Terrain({
  doc,
  onCellDown,
  onCellMove,
}: {
  doc: MapDocument;
  onCellDown?: CellPointerHandler;
  onCellMove?: CellPointerHandler;
}) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);
  const count = doc.cols * doc.rows;

  useLayoutEffect(() => {
    const b = bodies.current;
    const t = tops.current;
    if (!b || !t) return;
    for (let y = 0; y < doc.rows; y++) {
      for (let x = 0; x < doc.cols; x++) {
        const i = cellIndex(doc, x, y);
        const def = TERRAINS[doc.terrain[i]];
        const [wx, wz] = cellToWorld(doc, x, y);
        const top = cellTop(doc, x, y);
        const bodyH = top - TOP_THICKNESS - BASE_Y;
        tmpMatrix.makeScale(1, Math.max(bodyH, 0.01), 1).setPosition(wx, BASE_Y + bodyH / 2, wz);
        b.setMatrixAt(i, tmpMatrix);
        b.setColorAt(i, jitter(def.side, x, y, 0.05));
        tmpMatrix.makeScale(1, TOP_THICKNESS, 1).setPosition(wx, top - TOP_THICKNESS / 2, wz);
        t.setMatrixAt(i, tmpMatrix);
        t.setColorAt(i, jitter(def.color, x, y));
      }
    }
    for (const mesh of [b, t]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [doc]);

  const toCell = (e: ThreeEvent<PointerEvent>): Cell | null =>
    e.instanceId === undefined ? null : { x: e.instanceId % doc.cols, y: Math.floor(e.instanceId / doc.cols) };
  const handlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const c = toCell(e);
      if (c && onCellDown) onCellDown(c, e);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const c = toCell(e);
      if (c && onCellMove) onCellMove(c, e);
    },
  };

  return (
    <group>
      <instancedMesh key={`b${count}`} ref={bodies} args={[box, undefined, count]} castShadow receiveShadow {...handlers}>
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
      <instancedMesh key={`t${count}`} ref={tops} args={[box, undefined, count]} receiveShadow {...handlers}>
        <meshStandardMaterial flatShading roughness={0.85} />
      </instancedMesh>
    </group>
  );
}

/* ---------- Water ---------- */

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    world.y += sin(world.x * 1.7 + uTime * 1.3) * 0.015 + cos(world.z * 2.1 + uTime) * 0.015;
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uFoam;
  varying vec2 vWorld;
  void main() {
    // Two warped wave bands give soft, irregular highlights instead of a dot grid.
    float a = sin(vWorld.x * 1.3 + uTime * 0.8 + sin(vWorld.y * 0.7 + uTime * 0.4) * 2.0);
    float b = sin(vWorld.y * 1.7 - uTime * 0.6 + sin(vWorld.x * 0.9 - uTime * 0.3) * 1.6);
    float sparkle = smoothstep(0.55, 1.0, a * b);
    vec3 color = mix(uColor, uFoam, sparkle * 0.35);
    gl_FragColor = vec4(color, 0.7);
  }
`;

function Water({ doc }: { doc: MapDocument }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color("#3f8fb5") }, uFoam: { value: new THREE.Color("#d8f1ff") } }),
    [],
  );
  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta;
  });
  const hasWater = doc.terrain.some((t) => TERRAINS[t].kind === "water");
  if (!hasWater) return null;
  // One plane for the whole map: solid tiles rise above the water line and hide it.
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={WATER_LINE} raycast={() => null}>
      <planeGeometry args={[doc.cols, doc.rows, doc.cols * 2, doc.rows * 2]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={waterVertex} fragmentShader={waterFragment} transparent depthWrite={false} />
    </mesh>
  );
}

/* ---------- Imported picture ---------- */

function BackgroundTexture({ doc, url }: { doc: MapDocument; url: string }) {
  const texture = useTexture(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  const bg = doc.background!;
  const { center, size } = backgroundPlane(doc, bg);
  // Just above level-0 ground: raised walls and hills still rise through it.
  return (
    <mesh rotation-x={-Math.PI / 2} position={[center[0], 0.004, center[1]]} receiveShadow raycast={() => null}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} roughness={1} transparent={bg.opacity < 1} opacity={bg.opacity} />
    </mesh>
  );
}

function BackgroundImage({ doc }: { doc: MapDocument }) {
  const url = useMapImage(doc.background?.imageId);
  if (!doc.background || !url) return null;
  return (
    <Suspense fallback={null}>
      <BackgroundTexture doc={doc} url={url} />
    </Suspense>
  );
}

/* ---------- GM notes ---------- */

function NotesLayer({ doc, notes }: { doc: MapDocument; notes: MapNote[] }) {
  return (
    <>
      {notes.map((n) => {
        if (n.x >= doc.cols || n.y >= doc.rows) return null;
        const [wx, wz] = cellToWorld(doc, n.x, n.y);
        return (
          <Html key={n.id} position={[wx, cellStandY(doc, n.x, n.y) + 0.35, wz]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
            <div className="flex max-w-40 items-start gap-1 rounded-md border border-warning/50 bg-canvas/90 px-1.5 py-0.5 text-[11px] leading-tight text-fg shadow">
              <span aria-hidden className="text-warning">●</span>
              <span className="line-clamp-3">{n.text}</span>
            </div>
          </Html>
        );
      })}
    </>
  );
}

/* ---------- Grid ---------- */

function GridLines({ doc }: { doc: MapDocument }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (let y = 0; y < doc.rows; y++) {
      for (let x = 0; x < doc.cols; x++) {
        const [wx, wz] = cellToWorld(doc, x, y);
        const h = Math.max(cellTop(doc, x, y), WATER_LINE) + 0.01;
        const [x0, x1, z0, z1] = [wx - 0.5, wx + 0.5, wz - 0.5, wz + 0.5];
        points.push(x0, h, z0, x1, h, z0, x0, h, z0, x0, h, z1);
        if (x === doc.cols - 1) points.push(x1, h, z0, x1, h, z1);
        if (y === doc.rows - 1) points.push(x0, h, z1, x1, h, z1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, [doc]);
  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial color="#000000" transparent opacity={0.22} />
    </lineSegments>
  );
}

/* ---------- Props ---------- */

/** Kenney foliage uses a teal palette; recolour it to match the terrain greens and the Quaternius trees. */
const KENNEY_RECOLOR: Record<string, string> = { leafsGreen: "#4f8f36", leafsDark: "#3b6f2c", grass: "#5f9e42" };

function PropModel({ prop, doc, file }: { prop: PlacedProp; doc: MapDocument; file: string }) {
  const def = PROP_BY_ID.get(prop.propId)!;
  const { scene } = useGLTF(file);
  const fitted = useMemo(() => {
    // Quaternius packs store wind/sway masks in COLOR_0; as colours they tint foliage cyan.
    const ignoreVertexColors = file.includes("/q_");
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!ignoreVertexColors) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const tint = KENNEY_RECOLOR[m.name];
          if (tint) (m as THREE.MeshStandardMaterial).color.set(tint);
        }
      }
      if (ignoreVertexColors) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if ((m as THREE.MeshStandardMaterial).vertexColors) {
            (m as THREE.MeshStandardMaterial).vertexColors = false;
            m.needsUpdate = true;
          }
        }
      }
    });
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = def.fit.by === "height" ? def.fit.size / Math.max(size.y, 1e-3) : def.fit.size / Math.max(size.x, size.z, 1e-3);
    return { scale, offset: new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale) };
  }, [scene, def, file]);
  const [wx, wz] = cellToWorld(doc, prop.x, prop.y);
  const y = cellStandY(doc, prop.x, prop.y);
  return (
    <group position={[wx, y, wz]} rotation-y={(prop.rotation * Math.PI) / 180}>
      <Clone object={scene} scale={fitted.scale} position={fitted.offset} raycast={() => null} />
    </group>
  );
}

/* ---------- Doors, gates and traps (procedural) ---------- */

/** "gm" sees hidden traps as ghosts; "player" does not see them at all. */
export type FeatureView = "gm" | "player";
export type FeatureHandler = (prop: PlacedProp, event: ThreeEvent<PointerEvent>) => void;

const WOOD = "#7a5230";
const WOOD_DARK = "#4a3020";
const IRON = "#3b3f46";
const STONE = "#7d8088";

/** Eases a value towards `goal` every frame (doors swing, gates rise, spikes pop). */
function useEased(goal: number, speed = 8) {
  const value = useRef(goal);
  useFrame((_, delta) => {
    value.current += (goal - value.current) * Math.min(1, delta * speed);
  });
  return value;
}

function Mat({ color, ghost, metal }: { color: string; ghost?: boolean; metal?: boolean }) {
  return <meshStandardMaterial color={color} roughness={metal ? 0.45 : 0.85} metalness={metal ? 0.6 : 0} transparent={ghost} opacity={ghost ? 0.4 : 1} depthWrite={!ghost} />;
}

function DoorModel({ open, locked }: { open: boolean; locked: boolean }) {
  const hinge = useRef<THREE.Group>(null);
  const angle = useEased(open ? -1.5 : 0, 6);
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.y = angle.current;
  });
  return (
    <group>
      {[-0.47, 0.47].map((x) => (
        <mesh key={x} castShadow position={[x, 0.66, 0]}>
          <boxGeometry args={[0.1, 1.32, 0.16]} />
          <Mat color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.3, 0]}>
        <boxGeometry args={[1.04, 0.12, 0.18]} />
        <Mat color={WOOD_DARK} />
      </mesh>
      <group ref={hinge} position={[-0.42, 0, 0]}>
        <mesh castShadow receiveShadow position={[0.42, 0.62, 0]}>
          <boxGeometry args={[0.84, 1.2, 0.07]} />
          <Mat color={WOOD} />
        </mesh>
        {[0.3, 0.95].map((y) => (
          <mesh key={y} position={[0.42, y, 0]}>
            <boxGeometry args={[0.86, 0.06, 0.09]} />
            <Mat color={IRON} metal />
          </mesh>
        ))}
        <mesh position={[0.74, 0.62, 0.06]}>
          <sphereGeometry args={[0.035, 12, 10]} />
          <Mat color="#d4a017" metal />
        </mesh>
        {locked && (
          <mesh position={[0.74, 0.5, 0.07]}>
            <boxGeometry args={[0.09, 0.1, 0.04]} />
            <Mat color="#c2410c" metal />
          </mesh>
        )}
      </group>
    </group>
  );
}

function GateModel({ open, locked }: { open: boolean; locked: boolean }) {
  const bars = useRef<THREE.Group>(null);
  const lift = useEased(open ? 1.05 : 0, 4);
  useFrame(() => {
    if (bars.current) bars.current.position.y = lift.current;
  });
  return (
    <group>
      {[-0.47, 0.47].map((x) => (
        <mesh key={x} castShadow position={[x, 0.68, 0]}>
          <boxGeometry args={[0.12, 1.36, 0.2]} />
          <Mat color={STONE} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.34, 0]}>
        <boxGeometry args={[1.06, 0.14, 0.22]} />
        <Mat color={STONE} />
      </mesh>
      <group ref={bars}>
        {[-0.33, -0.2, -0.07, 0.07, 0.2, 0.33].map((x) => (
          <mesh key={x} castShadow position={[x, 0.62, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 1.2, 8]} />
            <Mat color={IRON} metal />
          </mesh>
        ))}
        {[0.25, 0.95].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[0.8, 0.04, 0.05]} />
            <Mat color={locked ? "#7c2d12" : IRON} metal />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const SPIKES = [-0.24, 0, 0.24].flatMap((x) => [-0.24, 0, 0.24].map((z) => [x, z] as const));

function SpikeTrapModel({ armed, ghost }: { armed: boolean; ghost: boolean }) {
  const spikes = useRef<THREE.Group>(null);
  // Armed: points barely show through the plate. Sprung: fully out.
  const rise = useEased(armed ? -0.12 : 0.06, 14);
  useFrame(() => {
    if (spikes.current) spikes.current.position.y = rise.current;
  });
  return (
    <group>
      <mesh receiveShadow position-y={0.02}>
        <boxGeometry args={[0.86, 0.04, 0.86]} />
        <Mat color="#4b4f57" ghost={ghost} metal />
      </mesh>
      <group ref={spikes}>
        {SPIKES.map(([x, z]) => (
          <mesh key={`${x},${z}`} castShadow position={[x, 0.15, z]}>
            <coneGeometry args={[0.055, 0.22, 8]} />
            <Mat color="#b8bcc4" ghost={ghost} metal />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DartTrapModel({ armed, ghost }: { armed: boolean; ghost: boolean }) {
  const plate = useRef<THREE.Mesh>(null);
  const height = useEased(armed ? 0.05 : 0.015, 14);
  useFrame(() => {
    if (plate.current) plate.current.position.y = height.current;
  });
  return (
    <group>
      <mesh receiveShadow position-y={0.01}>
        <boxGeometry args={[0.86, 0.02, 0.86]} />
        <Mat color="#5d6068" ghost={ghost} />
      </mesh>
      <mesh ref={plate} receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.62]} />
        <Mat color={armed ? "#9a9ea6" : "#6b6f77"} ghost={ghost} />
      </mesh>
    </group>
  );
}

/* ---------- Light ---------- */

function PoolLight({ doc, spot, flicker }: { doc: MapDocument; spot?: LightSpot; flicker: boolean }) {
  const ref = useRef<THREE.PointLight>(null);
  const base = spot ? 2.5 + spot.radius * 1.5 : 0;
  const target = useMemo(() => {
    if (!spot) return null;
    const [wx, wz] = cellToWorld(doc, spot.x, spot.y);
    return new THREE.Vector3(wx, cellStandY(doc, spot.x, spot.y) + spot.height, wz);
  }, [doc, spot]);
  const placed = useRef(false);
  useFrame((state) => {
    const light = ref.current;
    if (!light) return;
    if (!target) {
      light.intensity = 0;
      placed.current = false;
      return;
    }
    // A newly assigned light jumps into place; a carried one follows its token's walk.
    if (!placed.current) light.position.copy(target);
    else light.position.lerp(target, 0.12);
    placed.current = true;
    const t = state.clock.elapsedTime;
    light.intensity = spot?.flicker && flicker ? base * (0.86 + Math.sin(t * 11.3) * 0.06 + Math.sin(t * 7.1 + 1.3) * 0.05 + Math.random() * 0.05) : base;
  });
  return <pointLight ref={ref} color={spot?.color ?? "#000000"} intensity={0} distance={spot ? spot.radius + 1.5 : 1} decay={1.1} />;
}

function Flame({ size = 1, lit }: { size?: number; lit: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.set(size * (1 + Math.sin(t * 13) * 0.08), size * (1 + Math.sin(t * 9 + 2) * 0.15), size * (1 + Math.cos(t * 11) * 0.08));
  });
  if (!lit) return null;
  return (
    <group ref={ref}>
      <mesh position-y={0.09}>
        <coneGeometry args={[0.07, 0.2, 10]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <mesh position-y={0.07}>
        <coneGeometry args={[0.04, 0.12, 8]} />
        <meshBasicMaterial color="#fff2b0" />
      </mesh>
    </group>
  );
}

function TorchModel({ lit }: { lit: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 1, 8]} />
        <Mat color={IRON} metal />
      </mesh>
      <mesh castShadow position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.06, 0.035, 0.14, 10]} />
        <Mat color={WOOD_DARK} />
      </mesh>
      <group position-y={1.08}>
        <Flame lit={lit} />
      </group>
    </group>
  );
}

function BrazierModel({ lit }: { lit: boolean }) {
  return (
    <group>
      {[0, 120, 240].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} castShadow position={[Math.sin(a) * 0.2, 0.22, Math.cos(a) * 0.2]} rotation={[Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]}>
            <cylinderGeometry args={[0.025, 0.025, 0.46, 6]} />
            <Mat color={IRON} metal />
          </mesh>
        );
      })}
      <mesh castShadow receiveShadow position-y={0.5}>
        <cylinderGeometry args={[0.32, 0.2, 0.16, 16, 1, true]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.52}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 16]} />
        <meshStandardMaterial color={lit ? "#ff6a1a" : "#2a2522"} emissive={lit ? "#ff4d00" : "#000000"} emissiveIntensity={lit ? 1.4 : 0} />
      </mesh>
      <group position-y={0.54}>
        <Flame size={1.8} lit={lit} />
      </group>
    </group>
  );
}

/** The fixed pool of point lights, given to the spots that matter most. */
function LightPool({ doc, carried, hiddenCells, focus, flicker }: { doc: MapDocument; carried: LightSpot[]; hiddenCells?: Set<number>; focus?: { x: number; y: number }; flicker: boolean }) {
  const spots = useMemo(() => {
    const fixed: LightSpot[] = doc.props.flatMap((p) => {
      const light = lightOf(p);
      if (!light || hiddenCells?.has(cellIndex(doc, p.x, p.y))) return [];
      return [{ key: p.id, x: p.x, y: p.y, height: p.propId === "torch" ? 1.15 : 0.8, ...light }];
    });
    return pickLights(carried, fixed, focus ?? { x: doc.cols / 2, y: doc.rows / 2 });
  }, [doc, carried, hiddenCells, focus]);
  return (
    <>
      {Array.from({ length: LIGHT_POOL }, (_, i) => (
        <PoolLight key={i} doc={doc} spot={spots[i]} flicker={flicker} />
      ))}
    </>
  );
}

const NO_LIGHTS: LightSpot[] = [];

/** Sun/sky intensities per ambient: daylight, dusk, darkness (moonlight). */
const AMBIENT_LIGHT: Record<Ambient, { sky: string; ground: string; hemi: number; sun: number; sunColor: string }> = {
  bright: { sky: "#dfe9ff", ground: "#3a2f45", hemi: 0.9, sun: 2.1, sunColor: "#ffffff" },
  dim: { sky: "#8ea2cc", ground: "#2a2433", hemi: 0.32, sun: 0.45, sunColor: "#b3c2ff" },
  dark: { sky: "#4a5a80", ground: "#141018", hemi: 0.09, sun: 0.07, sunColor: "#8ea2ff" },
};

function FeatureModel({ prop, doc, view, onDown }: { prop: PlacedProp; doc: MapDocument; view: FeatureView; onDown?: FeatureHandler }) {
  const def = PROP_BY_ID.get(prop.propId)!;
  const door = doorOf(prop);
  const trap = trapOf(prop);
  if (trap?.hidden && view === "player") return null;
  const [wx, wz] = cellToWorld(doc, prop.x, prop.y);
  const y = cellStandY(doc, prop.x, prop.y);
  const ghost = !!trap?.hidden;
  return (
    <group
      position={[wx, y, wz]}
      rotation-y={(prop.rotation * Math.PI) / 180}
      onPointerDown={
        onDown
          ? (e) => {
              if (e.nativeEvent.button !== 0) return;
              e.stopPropagation();
              onDown(prop, e);
            }
          : undefined
      }
    >
      {def.feature === "door" && door && <DoorModel open={door.open} locked={door.locked} />}
      {def.feature === "gate" && door && <GateModel open={door.open} locked={door.locked} />}
      {def.feature === "trap-spikes" && trap && <SpikeTrapModel armed={trap.armed} ghost={ghost} />}
      {def.feature === "trap-darts" && trap && <DartTrapModel armed={trap.armed} ghost={ghost} />}
      {def.feature === "torch" && <TorchModel lit={prop.lit !== false} />}
      {def.feature === "brazier" && <BrazierModel lit={prop.lit !== false} />}
      {/* Invisible, generous hit box: traps are flat and hard to click. */}
      {onDown && (
        <mesh position-y={0.3} visible={false}>
          <boxGeometry args={[0.9, 0.6, 0.9]} />
        </mesh>
      )}
    </group>
  );
}

function Props({ doc, hiddenCells, view, onFeatureDown }: { doc: MapDocument; hiddenCells?: Set<number>; view: FeatureView; onFeatureDown?: FeatureHandler }) {
  return (
    <>
      {doc.props.map((p) => {
        const def = PROP_BY_ID.get(p.propId);
        if (!def || hiddenCells?.has(cellIndex(doc, p.x, p.y))) return null;
        if (def.feature) return <FeatureModel key={p.id} prop={p} doc={doc} view={view} onDown={onFeatureDown} />;
        return def.file ? (
          <Suspense key={p.id} fallback={null}>
            <PropModel prop={p} doc={doc} file={def.file} />
          </Suspense>
        ) : null;
      })}
    </>
  );
}

/** Starts loading every model early so placing props in the editor feels instant. */
export function preloadMapProps() {
  for (const p of PROPS) if (p.file) useGLTF.preload(p.file);
}

/* ---------- Fog of war ---------- */

/**
 * `hidden`: never explored. `dim`: explored but not in sight right now.
 * Players get solid darkness over hidden cells; the GM sees through a veil.
 */
export interface FogView {
  hidden: Set<number>;
  dim: Set<number>;
  mode: FeatureView;
}

const FOG_COLOR = "#06050a";

function FogLayer({ doc, fog }: { doc: MapDocument; fog: FogView }) {
  const hidden = useRef<THREE.InstancedMesh>(null);
  const dim = useRef<THREE.InstancedMesh>(null);
  const max = doc.cols * doc.rows;
  const solid = fog.mode === "player";

  useLayoutEffect(() => {
    const fill = (mesh: THREE.InstancedMesh | null, cells: Set<number>, column: boolean) => {
      if (!mesh) return;
      let n = 0;
      for (const i of cells) {
        if (i < 0 || i >= max) continue;
        const x = i % doc.cols;
        const y = Math.floor(i / doc.cols);
        const [wx, wz] = cellToWorld(doc, x, y);
        const top = Math.max(cellTop(doc, x, y), WATER_LINE) + 0.05;
        // Columns overlap their neighbours slightly so no seam shows. Per-cell height: one flat ceiling would wall off the visible area in perspective on hilly maps.
        if (column) tmpMatrix.makeScale(1.02, top - BASE_Y, 1.02).setPosition(wx, (top + BASE_Y) / 2, wz);
        else tmpMatrix.makeScale(1, 0.02, 1).setPosition(wx, top - 0.01, wz);
        mesh.setMatrixAt(n++, tmpMatrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    fill(hidden.current, fog.hidden, solid);
    fill(dim.current, fog.dim, false);
  }, [doc, fog, max, solid]);

  return (
    <>
      <instancedMesh key={`h${max}${solid}`} ref={hidden} args={[box, undefined, max]} raycast={() => null} renderOrder={3}>
        <meshBasicMaterial color={FOG_COLOR} transparent={!solid} opacity={solid ? 1 : 0.6} depthWrite={solid} />
      </instancedMesh>
      <instancedMesh key={`d${max}`} ref={dim} args={[box, undefined, max]} raycast={() => null} renderOrder={3}>
        <meshBasicMaterial color={FOG_COLOR} transparent opacity={solid ? 0.55 : 0.28} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/* ---------- Cell highlight (tool previews, movement range) ---------- */

export function CellHighlights({ doc, cells, color = "#a855f7", opacity = 0.4 }: { doc: MapDocument; cells: Cell[]; color?: string; opacity?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const max = doc.cols * doc.rows;
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x >= doc.cols || c.y >= doc.rows || n >= max) continue;
      const [wx, wz] = cellToWorld(doc, c.x, c.y);
      tmpMatrix.makeScale(0.92, 0.04, 0.92).setPosition(wx, Math.max(cellTop(doc, c.x, c.y), WATER_LINE) + 0.04, wz);
      m.setMatrixAt(n++, tmpMatrix);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }, [doc, cells, max]);
  return (
    <instancedMesh key={max} ref={mesh} args={[box, undefined, max]} raycast={() => null} renderOrder={2}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}

/* ---------- Camera ---------- */

export type CameraView = { mode: "perspective" | "top"; rotation: number; nonce: number };

const TILT = (52 * Math.PI) / 180;

function CameraRig({ doc, view }: { doc: MapDocument; view: CameraView }) {
  const { camera, controls, size } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    size: { width: number; height: number };
  };
  const goal = useRef<THREE.Vector3 | null>(null);
  const aspect = size.width / Math.max(size.height, 1);

  useLayoutEffect(() => {
    // Distance that fits the whole map in view for the current canvas proportions.
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const angle = (view.rotation * Math.PI) / 180;
    const across = Math.abs(Math.cos(angle)) * doc.cols + Math.abs(Math.sin(angle)) * doc.rows;
    const along = Math.abs(Math.sin(angle)) * doc.cols + Math.abs(Math.cos(angle)) * doc.rows;
    const distance = Math.max(across / 2 / Math.tan(halfH), along / 2 / Math.tan(halfV)) * 1.08;
    goal.current =
      view.mode === "top"
        ? new THREE.Vector3(Math.sin(angle) * 0.01, distance, Math.cos(angle) * 0.01)
        : new THREE.Vector3(Math.sin(angle) * distance * Math.cos(TILT), distance * Math.sin(TILT), Math.cos(angle) * distance * Math.cos(TILT));
    controls?.target.set(0, 0, 0);
  }, [doc.cols, doc.rows, view, controls, aspect, camera]);

  useFrame(() => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 0.14);
    controls?.update();
    if (camera.position.distanceTo(goal.current) < 0.05) goal.current = null;
  });
  return null;
}

/* ---------- Scene ---------- */

export function MapCanvas({
  doc,
  view,
  showGrid = true,
  controlsEnabled = true,
  onCellDown,
  onCellMove,
  onPointerUp,
  onMissed,
  fog,
  featureView = "gm",
  onFeatureDown,
  showProps = true,
  showBackground = true,
  notes,
  carriedLights = NO_LIGHTS,
  lightFocus,
  flicker = true,
  children,
}: {
  doc: MapDocument;
  view: CameraView;
  showGrid?: boolean;
  controlsEnabled?: boolean;
  onCellDown?: CellPointerHandler;
  onCellMove?: CellPointerHandler;
  onPointerUp?: () => void;
  onMissed?: () => void;
  fog?: FogView | null;
  featureView?: FeatureView;
  onFeatureDown?: FeatureHandler;
  /** Layer toggles (editor). */
  showProps?: boolean;
  showBackground?: boolean;
  /** GM notes to draw; null/undefined hides the layer (always for players). */
  notes?: MapNote[] | null;
  /** Lights carried by tokens (the caller leaves out what the viewer must not see). */
  carriedLights?: LightSpot[];
  /** Where the action is: the map's nearest fires get the pooled lights. */
  lightFocus?: { x: number; y: number };
  /** Fire flicker (off with reduced motion). */
  flicker?: boolean;
  children?: ReactNode;
}) {
  const span = Math.max(doc.cols, doc.rows);
  const ambient = AMBIENT_LIGHT[doc.ambient ?? "bright"];
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.1, far: span * 6, position: [0, span * 0.8, span * 0.6] }}
      onPointerUp={onPointerUp}
      onPointerMissed={onMissed}
      onContextMenu={(e) => e.preventDefault()}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#0b0a0f"]} />
      <fog attach="fog" args={["#0b0a0f", span * 1.6, span * 3.2]} />
      <hemisphereLight args={[ambient.sky, ambient.ground, ambient.hemi]} />
      <directionalLight
        position={[span * 0.4, span * 0.9, span * 0.25]}
        intensity={ambient.sun}
        color={ambient.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-span * 0.7}
        shadow-camera-right={span * 0.7}
        shadow-camera-top={span * 0.7}
        shadow-camera-bottom={-span * 0.7}
      />
      <Terrain doc={doc} onCellDown={onCellDown} onCellMove={onCellMove} />
      <Water doc={doc} />
      {showBackground && <BackgroundImage doc={doc} />}
      {showGrid && <GridLines doc={doc} />}
      {showProps && <Props doc={doc} view={featureView} onFeatureDown={onFeatureDown} hiddenCells={fog?.mode === "player" ? fog.hidden : undefined} />}
      <LightPool doc={doc} carried={carriedLights} hiddenCells={fog?.mode === "player" ? fog.hidden : undefined} focus={lightFocus} flicker={flicker} />
      {notes && notes.length > 0 && <NotesLayer doc={doc} notes={notes} />}
      {fog && <FogLayer doc={doc} fog={fog} />}
      {children}
      <MapControls
        makeDefault
        enabled={controlsEnabled}
        enableDamping
        maxPolarAngle={1.12}
        minDistance={4}
        maxDistance={span * 3.5}
        mouseButtons={{ LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
      <CameraRig doc={doc} view={view} />
    </Canvas>
  );
}
