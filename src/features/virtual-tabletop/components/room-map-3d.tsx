"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Html, Line } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3x3, Mountain, RotateCcw, RotateCw, ScanEye } from "lucide-react";
import * as THREE from "three";
import { cn } from "@/lib/cn";
import { toHexColor } from "@/lib/color";
import { initials } from "@/lib/format";
import { CellHighlights, cellStandY, cellToWorld, MapCanvas, preloadMapProps, type CameraView } from "@/features/map/components/map-scene";
import type { MapDocument } from "@/features/map/model/map-document";
import { brushCells, type Cell } from "@/features/map/model/shapes";
import { useMapEditorStore } from "@/features/map-editor/store/map-editor.store";
import { modelFor } from "../model/character-models";
import { canStand, gridDistance, isWall } from "../model/map";
import { CharacterFigure, preloadCharacterModel } from "./character-figure";
import { currentTurnToken, isDown } from "../model/room-engine";
import type { RoomState, RoomToken } from "../model/types";
import { useRoomStore, type TokenFx } from "../store/room.store";

type Drag = { tokenId: string; origin: Cell; hover: Cell };

/**
 * The room's 3D table: renders the map (or the editor's draft while editing),
 * tokens, movement previews and damage numbers, and routes pointer input to
 * either token movement or the map editor.
 */
export function RoomMap3D({ room, editing, onMove }: { room: RoomState; editing: boolean; onMove: (token: RoomToken, cell: Cell) => void }) {
  const draft = useMapEditorStore((s) => s.draft);
  const stroke = useMapEditorStore((s) => s.stroke);
  const brushSize = useMapEditorStore((s) => s.brushSize);
  const shape = useMapEditorStore((s) => s.shape);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const select = useRoomStore((s) => s.select);
  const fx = useRoomStore((s) => s.fx);
  const [view, setView] = useState<CameraView>({ mode: "perspective", rotation: 0, nonce: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const doc: MapDocument = editing && draft ? draft : room.map;
  const turnToken = currentTurnToken(room);

  useEffect(() => preloadMapProps(), []);
  // Start loading the models present at the table.
  const modelFiles = [...new Set(room.tokens.map((t) => modelFor(t).file))].join("|");
  useEffect(() => {
    for (const file of modelFiles.split("|").filter(Boolean)) preloadCharacterModel(file);
  }, [modelFiles]);

  // Finish drags and strokes even if the pointer is released outside the canvas.
  const dragRef = useRef(drag);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    const up = () => {
      if (editing) useMapEditorStore.getState().endStroke();
      const d = dragRef.current;
      if (!d) return;
      const token = room.tokens.find((t) => t.id === d.tokenId);
      const moved = d.hover.x !== d.origin.x || d.hover.y !== d.origin.y;
      if (token && moved && canStand(room.map, room.tokens, d.hover, token.id)) onMove(token, d.hover);
      setDrag(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [editing, room, onMove]);

  function onCellDown(cell: Cell, e: ThreeEvent<PointerEvent>) {
    if (e.nativeEvent.button !== 0) return;
    if (editing) {
      e.stopPropagation();
      useMapEditorStore.getState().beginStroke(cell);
    }
  }

  function onCellMove(cell: Cell) {
    if (!hover || hover.x !== cell.x || hover.y !== cell.y) setHover(cell);
    if (editing) {
      if (useMapEditorStore.getState().stroke) useMapEditorStore.getState().moveStroke(cell);
    } else if (drag && (drag.hover.x !== cell.x || drag.hover.y !== cell.y)) {
      setDrag({ ...drag, hover: cell });
    }
  }

  function onTokenDown(token: RoomToken, e: ThreeEvent<PointerEvent>) {
    if (editing || e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    select(token.id);
    if (!isDown(token)) setDrag({ tokenId: token.id, origin: { x: token.x, y: token.y }, hover: { x: token.x, y: token.y } });
  }

  const dragging = drag ? room.tokens.find((t) => t.id === drag.tokenId) : undefined;

  const rangeCells = useMemo(() => {
    if (!drag || !dragging) return [];
    const out: Cell[] = [];
    const r = dragging.stats.speed;
    for (let y = drag.origin.y - r; y <= drag.origin.y + r; y++)
      for (let x = drag.origin.x - r; x <= drag.origin.x + r; x++) if (!isWall(room.map, { x, y })) out.push({ x, y });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when the drag starts
  }, [drag?.tokenId, drag?.origin.x, drag?.origin.y, room.map]);

  const editPreview = useMemo(() => {
    if (!editing) return [];
    const preview = useMapEditorStore.getState().previewCells();
    if (preview.length) return preview;
    return hover && !stroke && shape !== "fill" ? brushCells(hover, shape === "brush" ? brushSize : 1) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stroke/draft drive the preview
  }, [editing, stroke, hover, brushSize, shape, draft]);

  const dragValid = !!(drag && dragging && canStand(room.map, room.tokens, drag.hover, dragging.id));
  const distance = drag ? gridDistance(drag.origin, drag.hover) : 0;

  return (
    <div className="relative h-full w-full" onPointerLeave={() => setHover(null)}>
      <MapCanvas
        doc={doc}
        view={view}
        showGrid={showGrid}
        controlsEnabled={!drag && !stroke}
        onCellDown={onCellDown}
        onCellMove={onCellMove}
        onMissed={() => !editing && select(null)}
      >
        {editing ? (
          <CellHighlights doc={doc} cells={editPreview} color="#c084fc" opacity={0.45} />
        ) : (
          <>
            {drag && <CellHighlights doc={doc} cells={rangeCells} color="#a855f7" opacity={0.14} />}
            {drag && <CellHighlights doc={doc} cells={[drag.hover]} color={dragValid ? "#a855f7" : "#ef4444"} opacity={0.55} />}
            {drag && dragging && distance > 0 && <MoveLine doc={doc} from={drag.origin} to={drag.hover} valid={dragValid} label={`${distance} □ · ${(distance * doc.cellDistance).toLocaleString("pt-BR")} ${doc.cellUnit}`} overSpeed={distance > dragging.stats.speed} />}
            {room.tokens.map((t) => (
              <Token3D key={t.id} doc={doc} token={t} tokens={room.tokens} selected={t.id === selectedId} active={t.id === turnToken?.id} onPointerDown={(e) => onTokenDown(t, e)} />
            ))}
            {fx.map((f) => (
              <FloatingNumber key={f.id} doc={doc} fx={f} token={room.tokens.find((t) => t.id === f.tokenId)} />
            ))}
          </>
        )}
      </MapCanvas>

      <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-lg border border-line bg-surface/90 backdrop-blur">
        <ViewButton label={view.mode === "top" ? "Vista em perspectiva" : "Vista de cima"} active={view.mode === "top"} onClick={() => setView((v) => ({ ...v, mode: v.mode === "top" ? "perspective" : "top", nonce: v.nonce + 1 }))}>
          {view.mode === "top" ? <Mountain className="size-4" /> : <ScanEye className="size-4" />}
        </ViewButton>
        <ViewButton label="Girar à esquerda" onClick={() => setView((v) => ({ ...v, rotation: v.rotation - 45, nonce: v.nonce + 1 }))}>
          <RotateCcw className="size-4" />
        </ViewButton>
        <ViewButton label="Girar à direita" onClick={() => setView((v) => ({ ...v, rotation: v.rotation + 45, nonce: v.nonce + 1 }))}>
          <RotateCw className="size-4" />
        </ViewButton>
        <ViewButton label="Grade" active={showGrid} onClick={() => setShowGrid((g) => !g)}>
          <Grid3x3 className="size-4" />
        </ViewButton>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-3 hidden rounded-md bg-canvas/80 px-2 py-1 text-[11px] text-fg-subtle backdrop-blur sm:block">
        {doc.name} · 1 □ = {doc.cellDistance.toLocaleString("pt-BR")} {doc.cellUnit} · direito move · rolagem zoom · meio gira
      </p>
    </div>
  );
}

function ViewButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("flex size-9 items-center justify-center hover:bg-surface-2", active ? "text-accent" : "text-fg-muted hover:text-fg")}>
      {children}
    </button>
  );
}

/* ---------- Tokens ---------- */

const ENEMY_RING = "#ef4444";

function Token3D({
  doc,
  token,
  tokens,
  selected,
  active,
  onPointerDown,
}: {
  doc: MapDocument;
  token: RoomToken;
  tokens: RoomToken[];
  selected: boolean;
  active: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const figure = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const moving = useRef(false);
  const cue = useRoomStore((s) => s.cues.filter((c) => c.tokenId === token.id).at(-1));
  const model = modelFor(token);
  const [wx, wz] = cellToWorld(doc, token.x, token.y);
  const y = cellStandY(doc, token.x, token.y);
  const down = isDown(token);
  const pct = Math.max(0, token.hp.current / token.hp.max);
  const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
  const target = cue?.targetId ? tokens.find((t) => t.id === cue.targetId) : undefined;
  const barY = model.height + (model.hover ?? 0) + 0.3;

  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      const dx = wx - g.position.x;
      const dz = wz - g.position.z;
      const dist = Math.hypot(dx, dz);
      moving.current = dist > 0.04;
      // Walk speed in cells/second, so long moves read as walking, not sliding.
      const step = Math.min(dist, 3.2 * delta + dist * 0.02);
      if (dist > 0) {
        g.position.x += (dx / dist) * Math.max(step, Math.min(dist, 0.05));
        g.position.z += (dz / dist) * Math.max(step, Math.min(dist, 0.05));
      }
      g.position.y += (y - g.position.y) * 0.2;
      // Face the walking direction, or the target of an attack/spell.
      let yaw: number | null = null;
      if (moving.current) yaw = Math.atan2(dx, dz);
      else if (target) {
        const [tx, tz] = cellToWorld(doc, target.x, target.y);
        yaw = Math.atan2(tx - g.position.x, tz - g.position.z);
      }
      if (yaw !== null && figure.current) {
        const cur = figure.current.rotation.y;
        const diff = Math.atan2(Math.sin(yaw - cur), Math.cos(yaw - cur));
        figure.current.rotation.y = cur + diff * 0.2;
      }
    }
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.08);
  });

  return (
    <group ref={group} position={[wx, y, wz]}>
      {active && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03} raycast={() => null}>
          <ringGeometry args={[0.42, 0.49, 40]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.9} />
        </mesh>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={() => null}>
          <circleGeometry args={[0.47, 40]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.3} />
        </mesh>
      )}
      <group onPointerDown={onPointerDown}>
        {/* Base disc: owner colour, red rim for enemies; also the click target. */}
        <mesh receiveShadow position-y={0.025}>
          <cylinderGeometry args={[0.4, 0.42, 0.05, 32]} />
          <meshStandardMaterial color={token.kind === "enemy" ? ENEMY_RING : toHexColor(token.color)} roughness={0.6} />
        </mesh>
        <mesh position-y={model.height / 2 + (model.hover ?? 0)} visible={false}>
          <cylinderGeometry args={[0.3, 0.3, model.height, 8]} />
        </mesh>
        <group ref={figure} position-y={0.05}>
          <Suspense fallback={<Pawn color={down ? "#6b7280" : toHexColor(token.color)} />}>
            <CharacterFigure model={model} movingRef={moving} down={down} cue={cue} />
          </Suspense>
        </group>
        {token.controller === "bot" && (
          <mesh position-y={barY + 0.16} raycast={() => null}>
            <octahedronGeometry args={[0.06]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
      {!down && (
        <Billboard position-y={barY}>
          <mesh raycast={() => null}>
            <planeGeometry args={[0.72, 0.09]} />
            <meshBasicMaterial color="#111018" />
          </mesh>
          <mesh position={[-0.35 + 0.35 * pct, 0, 0.001]} raycast={() => null}>
            <planeGeometry args={[0.7 * pct, 0.06]} />
            <meshBasicMaterial color={hpColor} />
          </mesh>
        </Billboard>
      )}
      {(selected || active) && (
        <Html position={[0, barY + 0.25, 0]} center distanceFactor={14} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md bg-canvas/90 px-2 py-0.5 text-[11px] font-medium text-fg shadow">
            <span className="mr-1 font-mono text-fg-subtle">{initials(token.name)}</span>
            {token.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Simple pawn shown while a model loads. */
function Pawn({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow position-y={0.3}>
        <cylinderGeometry args={[0.16, 0.26, 0.44, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh castShadow position-y={0.64}>
        <sphereGeometry args={[0.17, 20, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  );
}

function MoveLine({ doc, from, to, valid, label, overSpeed }: { doc: MapDocument; from: Cell; to: Cell; valid: boolean; label: string; overSpeed: boolean }) {
  const [ax, az] = cellToWorld(doc, from.x, from.y);
  const [bx, bz] = cellToWorld(doc, to.x, to.y);
  const ay = cellStandY(doc, from.x, from.y) + 0.12;
  const by = cellStandY(doc, to.x, to.y) + 0.12;
  return (
    <>
      <Line points={[[ax, ay, az], [bx, by, bz]]} color={valid ? "#c084fc" : "#ef4444"} lineWidth={3} dashed dashSize={0.25} gapSize={0.15} />
      <Html position={[bx, by + 0.9, bz]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span className={cn("whitespace-nowrap rounded-md bg-canvas/90 px-2 py-0.5 font-mono text-xs", overSpeed ? "text-warning" : "text-fg")}>{label}</span>
      </Html>
    </>
  );
}

function FloatingNumber({ doc, fx, token }: { doc: MapDocument; fx: TokenFx; token?: RoomToken }) {
  if (!token) return null;
  const [wx, wz] = cellToWorld(doc, token.x, token.y);
  return (
    <Html position={[wx, cellStandY(doc, token.x, token.y) + 1.5, wz]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <AnimatePresence>
        <motion.span
          initial={{ y: 12, opacity: 0, scale: 0.6 }}
          animate={{ y: -18, opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn("block font-mono text-2xl font-bold [text-shadow:0_2px_6px_rgb(0_0_0/0.8)]", fx.tone === "damage" ? "text-danger" : "text-success")}
        >
          {fx.text}
        </motion.span>
      </AnimatePresence>
    </Html>
  );
}
