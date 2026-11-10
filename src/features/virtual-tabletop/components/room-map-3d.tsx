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
import { CellHighlights, cellStandY, cellToWorld, MapCanvas, preloadMapProps, type CameraView, type FeatureView, type FogView, type LightSpot } from "@/features/map/components/map-scene";
import { usePreferencesStore } from "@/stores/preferences.store";
import { cellIndex, featureAt, inBounds, trapOf, type MapDocument, type MapSpawn, type PlacedProp } from "@/features/map/model/map-document";
import { ATTITUDE_HEX } from "@/features/map-editor/model/spawn-presets";
import { brushCells, type Cell } from "@/features/map/model/shapes";
import { placesOneProp, useMapEditorStore } from "@/features/map-editor/store/map-editor.store";
import { CHARACTER_MODEL_BY_ID, modelFor, sizeOf } from "../model/character-models";
import { anchorFor, canStand, footprint, gridDistance, isWall } from "../model/map";
import { CharacterFigure, preloadCharacterModel } from "./character-figure";
import { currentTurnToken, isDown, partyVision } from "../model/room-engine";
import type { RoomState, RoomToken } from "../model/types";
import { useRoomStore, type TokenFx } from "../store/room.store";

type Drag = { tokenId: string; origin: Cell; hover: Cell };

/** Carried lights from their compact key ("id:x:y:radius|…"), so the light list only changes when a light moves. */
function parseCarried(key: string): LightSpot[] {
  if (!key) return [];
  return key.split("|").map((k) => {
    const [id, x, y, radius] = k.split(":");
    return { key: id, x: Number(x), y: Number(y), radius: Number(radius), color: "#ffb066", flicker: true, height: 1.1 };
  });
}
type FogStroke = { mode: "reveal" | "hide"; cells: Set<number> };

/**
 * The room's 3D table: renders the map (or the editor's draft while editing),
 * tokens, movement previews and damage numbers, and routes pointer input to
 * either token movement or the map editor.
 */
export function RoomMap3D({
  room,
  editing,
  viewer,
  onMove,
  onFogPaint,
  canMove,
}: {
  room: RoomState;
  editing: boolean;
  /** Which tokens this viewer may drag (players: their own). Everyone by default. */
  canMove?: (token: RoomToken) => boolean;
  /** "player": the fog hides what the party has not seen, and hidden traps are invisible. */
  viewer: FeatureView;
  onMove: (token: RoomToken, cell: Cell, options: { teleport?: boolean }) => void;
  onFogPaint: (mode: "reveal" | "hide", cells: number[]) => void;
}) {
  const draft = useMapEditorStore((s) => s.draft);
  const stroke = useMapEditorStore((s) => s.stroke);
  const brushSize = useMapEditorStore((s) => s.brushSize);
  const shape = useMapEditorStore((s) => s.shape);
  const editTool = useMapEditorStore((s) => s.tool);
  const onePiece = useMapEditorStore(placesOneProp);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const select = useRoomStore((s) => s.select);
  const selectFeature = useRoomStore((s) => s.selectFeature);
  const selectedFeatureId = useRoomStore((s) => s.selectedFeatureId);
  const fogBrush = useRoomStore((s) => s.fogBrush);
  const fogBrushSize = useRoomStore((s) => s.fogBrushSize);
  const showNotes = useRoomStore((s) => s.showNotes);
  const layers = useMapEditorStore((s) => s.layers);
  const fx = useRoomStore((s) => s.fx);
  const [fogStroke, setFogStroke] = useState<FogStroke | null>(null);
  const [view, setView] = useState<CameraView>({ mode: "perspective", rotation: 0, nonce: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const doc: MapDocument = editing && draft ? draft : room.map;
  const turnToken = currentTurnToken(room);
  const painting = !editing && !!fogBrush && room.fog.enabled;

  // What the party sees now; null when the fog is off (everything is visible).
  // Only map, tokens and fog matter: chat and combat events must not recompute line of sight.
  const { map: roomMap, tokens: roomTokens } = room;
  const { enabled: fogOn, vision } = room.fog;
  const visible = useMemo(
    () => (fogOn ? partyVision({ map: roomMap, tokens: roomTokens, fog: { enabled: true, vision, explored: [] } }) : null),
    [roomMap, roomTokens, fogOn, vision],
  );
  const fog: FogView | null = useMemo(() => {
    if (editing || !visible) return null;
    const explored = new Set(room.fog.explored);
    const hidden = new Set<number>();
    const dim = new Set<number>();
    for (let i = 0; i < room.map.cols * room.map.rows; i++) {
      if (visible.has(i)) continue;
      (explored.has(i) ? dim : hidden).add(i);
    }
    return { hidden, dim, mode: viewer };
  }, [editing, visible, room.fog.explored, room.map.cols, room.map.rows, viewer]);
  const seen = (cell: Cell) => !visible || viewer === "gm" || visible.has(cellIndex(room.map, cell.x, cell.y));
  // A large enemy shows as soon as any square of it is in sight.
  const shownTokens = room.tokens.filter((t) => t.kind !== "enemy" || footprint(t, sizeOf(t)).some(seen));
  const reduceMotion = usePreferencesStore((s) => s.reduceMotion);

  // Carried lights of tokens the viewer may know about (not glowing out of unexplored darkness).
  const carriedKey = shownTokens
    .filter((t) => (t.light ?? 0) > 0 && !isDown(t) && !(viewer === "player" && fog?.hidden.has(cellIndex(room.map, t.x, t.y))))
    .map((t) => `${t.id}:${t.x}:${t.y}:${t.light}`)
    .join("|");
  const carriedLights = parseCarried(carriedKey);
  // The party's centre: the fires nearest to it get the pooled lights.
  const party = room.tokens.filter((t) => t.kind === "pc" && !isDown(t));
  const focusKey = party.length ? `${Math.round(party.reduce((a, t) => a + t.x, 0) / party.length)}:${Math.round(party.reduce((a, t) => a + t.y, 0) / party.length)}` : "";
  const [fx0, fy0] = focusKey ? focusKey.split(":").map(Number) : [];
  const lightFocus = focusKey ? { x: fx0, y: fy0 } : undefined;
  /** Players cannot pick anything in never-explored darkness. */
  const reachable = (cell: Cell) => viewer === "gm" || !fog?.hidden.has(cellIndex(room.map, cell.x, cell.y));

  useEffect(() => preloadMapProps(), []);
  // Start loading the models present at the table.
  const modelFiles = [...new Set(room.tokens.map((t) => modelFor(t).file))].join("|");
  useEffect(() => {
    for (const file of modelFiles.split("|").filter(Boolean)) preloadCharacterModel(file);
  }, [modelFiles]);

  // Finish drags and strokes even if the pointer is released outside the canvas.
  const dragRef = useRef(drag);
  // The fog stroke lives in a ref (pointer events can outrun renders); state only drives the preview.
  const fogRef = useRef<FogStroke | null>(null);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    const up = (e: PointerEvent) => {
      if (editing) useMapEditorStore.getState().endStroke();
      const f = fogRef.current;
      if (f) {
        fogRef.current = null;
        onFogPaint(f.mode, [...f.cells]);
        setFogStroke(null);
      }
      const d = dragRef.current;
      if (!d) return;
      const token = room.tokens.find((t) => t.id === d.tokenId);
      const moved = d.hover.x !== d.origin.x || d.hover.y !== d.origin.y;
      if (token && moved && canStand(room.map, room.tokens, d.hover, token.id)) onMove(token, d.hover, { teleport: viewer === "gm" && e.altKey });
      setDrag(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [editing, room, onMove, onFogPaint, viewer]);

  const brushIndices = (cell: Cell) =>
    brushCells(cell, fogBrushSize)
      .filter((c) => inBounds(room.map, c.x, c.y))
      .map((c) => cellIndex(room.map, c.x, c.y));

  function onCellDown(cell: Cell, e: ThreeEvent<PointerEvent>) {
    if (e.nativeEvent.button !== 0) return;
    if (editing) {
      e.stopPropagation();
      useMapEditorStore.getState().beginStroke(cell);
      return;
    }
    if (painting && fogBrush) {
      e.stopPropagation();
      fogRef.current = { mode: fogBrush, cells: new Set(brushIndices(cell)) };
      setFogStroke({ ...fogRef.current });
      return;
    }
    // Flat features (traps) are easier to pick by their square.
    const feature = featureAt(room.map, cell.x, cell.y);
    if (feature && reachable(cell) && (viewer === "gm" || !trapOf(feature)?.hidden)) selectFeature(feature.id);
  }

  function onFeatureDown(prop: PlacedProp) {
    if (!editing && !painting && reachable(prop)) selectFeature(prop.id);
  }

  function onCellMove(cell: Cell) {
    if (!hover || hover.x !== cell.x || hover.y !== cell.y) setHover(cell);
    const f = fogRef.current;
    if (f) {
      const fresh = brushIndices(cell).filter((i) => !f.cells.has(i));
      if (fresh.length) {
        fresh.forEach((i) => f.cells.add(i));
        setFogStroke({ ...f });
      }
      return;
    }
    if (editing) {
      if (useMapEditorStore.getState().stroke) useMapEditorStore.getState().moveStroke(cell);
    } else if (drag) {
      // Large creatures are dragged by their middle: the pointer's square becomes the centre of the block.
      const dragged = room.tokens.find((t) => t.id === drag.tokenId);
      const anchor = anchorFor(cell, dragged ? sizeOf(dragged) : 1);
      if (drag.hover.x !== anchor.x || drag.hover.y !== anchor.y) setDrag({ ...drag, hover: anchor });
    }
  }

  function onTokenDown(token: RoomToken, e: ThreeEvent<PointerEvent>) {
    if (editing || painting || e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    select(token.id);
    if (!isDown(token) && (canMove?.(token) ?? true)) setDrag({ tokenId: token.id, origin: { x: token.x, y: token.y }, hover: { x: token.x, y: token.y } });
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
    const pointTool = editTool === "spawn" || editTool === "build" || editTool === "note" || onePiece;
    const single = pointTool || shape !== "brush";
    return hover && !stroke && (shape !== "fill" || pointTool) ? brushCells(hover, single ? 1 : brushSize) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stroke/draft drive the preview
  }, [editing, stroke, hover, brushSize, shape, editTool, onePiece, draft]);

  const fogPreview = useMemo(() => {
    if (!painting) return [];
    const indices = fogStroke ? [...fogStroke.cells] : hover ? brushIndices(hover) : [];
    return indices.map((i) => ({ x: i % room.map.cols, y: Math.floor(i / room.map.cols) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- brushIndices only depends on the map and brush size
  }, [painting, fogStroke, hover, fogBrushSize, room.map]);
  const selectedFeature = selectedFeatureId ? room.map.props.find((p) => p.id === selectedFeatureId) : undefined;

  const dragValid = !!(drag && dragging && canStand(room.map, room.tokens, drag.hover, dragging.id));
  const distance = drag ? gridDistance(drag.origin, drag.hover) : 0;

  return (
    <div className="relative h-full w-full" onPointerLeave={() => setHover(null)}>
      <MapCanvas
        doc={doc}
        view={view}
        showGrid={showGrid}
        controlsEnabled={!drag && !stroke && !fogStroke}
        onCellDown={onCellDown}
        onCellMove={onCellMove}
        onMissed={() => {
          if (editing) return;
          select(null);
          selectFeature(null);
        }}
        fog={fog}
        carriedLights={editing ? undefined : carriedLights}
        lightFocus={lightFocus}
        flicker={!reduceMotion}
        showProps={!editing || layers.props.visible}
        showBackground={!editing || layers.background.visible}
        notes={editing ? (layers.notes.visible ? doc.notes : null) : viewer === "gm" && showNotes ? doc.notes : null}
        featureView={editing ? "gm" : viewer}
        onFeatureDown={editing ? undefined : onFeatureDown}
      >
        {editing ? (
          <>
            <CellHighlights doc={doc} cells={editPreview} color="#c084fc" opacity={0.45} />
            {layers.spawns.visible && doc.spawns?.map((sp) => <SpawnMarker key={sp.id} doc={doc} spawn={sp} />)}
          </>
        ) : (
          <>
            {painting && <CellHighlights doc={doc} cells={fogPreview} color={fogBrush === "reveal" ? "#fde68a" : "#1e1b2e"} opacity={0.5} />}
            {selectedFeature && <CellHighlights doc={doc} cells={[selectedFeature]} color="#f59e0b" opacity={0.45} />}
            {drag && <CellHighlights doc={doc} cells={rangeCells} color="#a855f7" opacity={0.14} />}
            {drag && <CellHighlights doc={doc} cells={footprint(drag.hover, dragging ? sizeOf(dragging) : 1)} color={dragValid ? "#a855f7" : "#ef4444"} opacity={0.55} />}
            {drag && dragging && distance > 0 && <MoveLine doc={doc} from={drag.origin} to={drag.hover} valid={dragValid} label={`${distance} □ · ${(distance * doc.cellDistance).toLocaleString("pt-BR")} ${doc.cellUnit}`} overSpeed={distance > dragging.stats.speed} />}
            {shownTokens.map((t) => (
              <Token3D key={t.id} doc={doc} token={t} tokens={room.tokens} selected={t.id === selectedId} active={t.id === turnToken?.id} onPointerDown={(e) => onTokenDown(t, e)} />
            ))}
            {fx.map((f) => (
              <FloatingNumber key={f.id} doc={doc} fx={f} token={shownTokens.find((t) => t.id === f.tokenId)} />
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

/** A character placed in the editor: its figure standing still, a ring in the attitude's colour and its name. */
function SpawnMarker({ doc, spawn }: { doc: MapDocument; spawn: MapSpawn }) {
  const still = useRef(false);
  if (spawn.x >= doc.cols || spawn.y >= doc.rows) return null;
  const model = CHARACTER_MODEL_BY_ID.get(spawn.modelId) ?? CHARACTER_MODEL_BY_ID.get("warrior")!;
  const size = sizeOf(spawn);
  const [wx, wz] = cellToWorld(doc, spawn.x + (size - 1) / 2, spawn.y + (size - 1) / 2);
  const color = ATTITUDE_HEX[spawn.attitude];
  return (
    <group position={[wx, cellStandY(doc, spawn.x, spawn.y), wz]} scale={size}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} raycast={() => null}>
        <ringGeometry args={[0.38, 0.47, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <Suspense fallback={null}>
        <CharacterFigure model={model} movingRef={still} down={false} cue={undefined} />
      </Suspense>
      <Html position={[0, model.height + (model.hover ?? 0) + 0.25, 0]} center zIndexRange={[14, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap rounded bg-canvas/85 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow" style={{ borderBottom: `2px solid ${color}` }}>
          {spawn.name}
        </span>
      </Html>
    </group>
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
  // A move with a route: walk it square by square (turning at corners) instead of cutting across.
  const route = useRoomStore((s) => s.routes[token.id]);
  const waypoints = useRef<[number, number, number][]>([]);
  const routeId = useRef<string | null>(null);
  // Large creatures stand on the middle of their block and are drawn that many times bigger.
  const size = sizeOf(token);
  const centre = (size - 1) / 2;
  useEffect(() => {
    if (!route || route.id === routeId.current) return;
    routeId.current = route.id;
    waypoints.current = route.cells.map((c) => {
      const [x, z] = cellToWorld(doc, c.x + centre, c.y + centre);
      return [x, z, cellStandY(doc, c.x, c.y)];
    });
  }, [route, doc, centre]);
  const model = modelFor(token);
  const [wx, wz] = cellToWorld(doc, token.x + centre, token.y + centre);
  const y = cellStandY(doc, token.x, token.y);
  const down = isDown(token);
  const pct = Math.max(0, token.hp.current / token.hp.max);
  const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
  const target = cue?.targetId ? tokens.find((t) => t.id === cue.targetId) : undefined;
  const barY = model.height + (model.hover ?? 0) + 0.3;

  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      // Next square of the route, else the token's square.
      let next = waypoints.current[0];
      while (next && Math.hypot(next[0] - g.position.x, next[1] - g.position.z) < 0.06) {
        waypoints.current.shift();
        next = waypoints.current[0];
      }
      const [gx, gz, gy] = next ?? [wx, wz, y];
      const dx = gx - g.position.x;
      const dz = gz - g.position.z;
      const dist = Math.hypot(dx, dz);
      moving.current = dist > 0.04 || waypoints.current.length > 0;
      // Walk speed in cells/second, so long moves read as walking, not sliding.
      const step = Math.min(dist, (next ? 4.2 : 3.2) * delta + (next ? 0 : dist * 0.02));
      if (dist > 0) {
        g.position.x += (dx / dist) * Math.max(step, Math.min(dist, 0.05));
        g.position.z += (dz / dist) * Math.max(step, Math.min(dist, 0.05));
      }
      g.position.y += (gy - g.position.y) * 0.25;
      // Face the walking direction, or the target of an attack/spell.
      let yaw: number | null = null;
      if (moving.current) yaw = Math.atan2(dx, dz);
      else if (target) {
        const targetCentre = (sizeOf(target) - 1) / 2;
        const [tx, tz] = cellToWorld(doc, target.x + targetCentre, target.y + targetCentre);
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
    <group ref={group} position={[wx, y, wz]} scale={size}>
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
  const size = sizeOf(token);
  const [wx, wz] = cellToWorld(doc, token.x + (size - 1) / 2, token.y + (size - 1) / 2);
  return (
    <Html position={[wx, cellStandY(doc, token.x, token.y) + 1.5 * size, wz]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
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
