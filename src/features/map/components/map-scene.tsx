"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Clone, MapControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  cellIndex,
  cellNoise,
  PROP_BY_ID,
  PROPS,
  TERRAINS,
  type MapDocument,
  type PlacedProp,
} from "../model/map-document";
import type { Cell } from "../model/shapes";

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

function PropModel({ prop, doc }: { prop: PlacedProp; doc: MapDocument }) {
  const def = PROP_BY_ID.get(prop.propId)!;
  const { scene } = useGLTF(def.file);
  const fitted = useMemo(() => {
    // Quaternius packs store wind/sway masks in COLOR_0; as colours they tint foliage cyan.
    const ignoreVertexColors = def.file.includes("/q_");
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
  }, [scene, def]);
  const [wx, wz] = cellToWorld(doc, prop.x, prop.y);
  const y = cellStandY(doc, prop.x, prop.y);
  return (
    <group position={[wx, y, wz]} rotation-y={(prop.rotation * Math.PI) / 180}>
      <Clone object={scene} scale={fitted.scale} position={fitted.offset} raycast={() => null} />
    </group>
  );
}

function Props({ doc }: { doc: MapDocument }) {
  return (
    <>
      {doc.props.map((p) =>
        PROP_BY_ID.has(p.propId) ? (
          <Suspense key={p.id} fallback={null}>
            <PropModel prop={p} doc={doc} />
          </Suspense>
        ) : null,
      )}
    </>
  );
}

/** Starts loading every model early so placing props in the editor feels instant. */
export function preloadMapProps() {
  for (const p of PROPS) useGLTF.preload(p.file);
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
  children?: ReactNode;
}) {
  const span = Math.max(doc.cols, doc.rows);
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
      <hemisphereLight args={["#dfe9ff", "#3a2f45", 0.9]} />
      <directionalLight
        position={[span * 0.4, span * 0.9, span * 0.25]}
        intensity={2.1}
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
      {showGrid && <GridLines doc={doc} />}
      <Props doc={doc} />
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
