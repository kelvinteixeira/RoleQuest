"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minus, Plus } from "lucide-react";
import { initials } from "@/lib/format";
import { canStand, gridDistance, type Cell } from "../model/map";
import { currentTurnToken, isDown } from "../model/room-engine";
import type { RoomState, RoomToken } from "../model/types";
import { useRoomStore } from "../store/room.store";

const CELL = 48;
const MIN_ZOOM_W = 0.3;
const MAX_ZOOM_W = 1.6;

type ViewBox = { x: number; y: number; w: number; h: number };
type Drag =
  | { kind: "token"; tokenId: string; origin: Cell; hover: Cell; moved: boolean }
  | { kind: "pan"; startX: number; startY: number; start: ViewBox; moved: boolean };

/**
 * Tactical map. SVG keeps the first version simple and crisp; the canvas
 * engine planned for large maps (Phase 3, tile editor) can replace this
 * component without touching the room state or panels.
 */
export function MapBoard({ room, onMove }: { room: RoomState; onMove: (token: RoomToken, cell: Cell) => void }) {
  const { map, tokens } = room;
  const full: ViewBox = useMemo(() => ({ x: 0, y: 0, w: map.cols * CELL, h: map.rows * CELL }), [map.cols, map.rows]);
  const [view, setView] = useState<ViewBox>(full);
  const [drag, setDrag] = useState<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const select = useRoomStore((s) => s.select);
  const fx = useRoomStore((s) => s.fx);
  const turnToken = currentTurnToken(room);
  const walls = useMemo(() => map.walls.map((w) => w.split(",").map(Number) as [number, number]), [map.walls]);

  function toSvg(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  }
  const toCell = (p: { x: number; y: number }): Cell => ({ x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) });

  function zoomBy(factor: number, center?: { x: number; y: number }) {
    setView((v) => {
      const w = Math.min(full.w * MAX_ZOOM_W, Math.max(full.w * MIN_ZOOM_W, v.w * factor));
      const h = w * (full.h / full.w);
      const c = center ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      return { x: c.x - ((c.x - v.x) * w) / v.w, y: c.y - ((c.y - v.y) * h) / v.h, w, h };
    });
  }

  function onWheel(e: WheelEvent<SVGSVGElement>) {
    zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1, toSvg(e));
  }

  function onTokenDown(e: ReactPointerEvent, token: RoomToken) {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    select(token.id);
    if (isDown(token)) return;
    setDrag({ kind: "token", tokenId: token.id, origin: { x: token.x, y: token.y }, hover: { x: token.x, y: token.y }, moved: false });
  }

  function onBoardDown(e: ReactPointerEvent<SVGSVGElement>) {
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, start: view, moved: false });
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!drag) return;
    if (drag.kind === "token") {
      const cell = toCell(toSvg(e));
      if (cell.x !== drag.hover.x || cell.y !== drag.hover.y) setDrag({ ...drag, hover: cell, moved: true });
      return;
    }
    const scale = 1 / (svgRef.current?.getScreenCTM()?.a ?? 1);
    const dx = (e.clientX - drag.startX) * scale;
    const dy = (e.clientY - drag.startY) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      setView({ ...drag.start, x: drag.start.x - dx, y: drag.start.y - dy });
      if (!drag.moved) setDrag({ ...drag, moved: true });
    }
  }

  function onPointerUp() {
    if (drag?.kind === "token" && drag.moved) {
      const token = tokens.find((t) => t.id === drag.tokenId);
      const same = drag.hover.x === drag.origin.x && drag.hover.y === drag.origin.y;
      if (token && !same && canStand(map, tokens, drag.hover, token.id)) onMove(token, drag.hover);
    }
    if (drag?.kind === "pan" && !drag.moved) select(null);
    setDrag(null);
  }

  const dragging = drag?.kind === "token" ? tokens.find((t) => t.id === drag.tokenId) : undefined;
  const dragValid = drag?.kind === "token" && dragging ? canStand(map, tokens, drag.hover, dragging.id) : false;
  const dragDistance = drag?.kind === "token" ? gridDistance(drag.origin, drag.hover) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.1_0.008_300)]">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="size-full touch-none select-none"
        style={{ cursor: drag?.kind === "pan" && drag.moved ? "grabbing" : "grab" }}
        onPointerDown={onBoardDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onWheel={onWheel}
        role="application"
        aria-label={`Mapa: ${map.name}`}
      >
        <defs>
          <pattern id="rq-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke="oklch(1 0 0 / 0.07)" strokeWidth="1" />
          </pattern>
          <radialGradient id="rq-vault-light" cx="0.65" cy="0.5" r="0.6">
            <stop offset="0" stopColor="oklch(0.6 0.2 302 / 0.12)" />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Floor: entry hall and sandy vault */}
        <rect width={9 * CELL} height={map.rows * CELL} fill="oklch(0.21 0.012 300)" />
        <rect x={9 * CELL} width={(map.cols - 9) * CELL} height={map.rows * CELL} fill="oklch(0.25 0.025 70)" />
        <rect width={map.cols * CELL} height={map.rows * CELL} fill="url(#rq-vault-light)" />
        <rect width={map.cols * CELL} height={map.rows * CELL} fill="url(#rq-grid)" />

        {walls.map(([x, y]) => (
          <g key={`${x},${y}`}>
            <rect x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill="oklch(0.14 0.01 300)" />
            <rect x={x * CELL} y={y * CELL} width={CELL} height={4} fill="oklch(1 0 0 / 0.06)" />
          </g>
        ))}

        {/* Movement range and path while dragging */}
        {drag?.kind === "token" && dragging && (
          <g pointerEvents="none">
            <rect
              x={(drag.origin.x - dragging.stats.speed) * CELL}
              y={(drag.origin.y - dragging.stats.speed) * CELL}
              width={(dragging.stats.speed * 2 + 1) * CELL}
              height={(dragging.stats.speed * 2 + 1) * CELL}
              fill="oklch(0.6 0.2 302 / 0.08)"
              stroke="oklch(0.7 0.2 302 / 0.35)"
              strokeDasharray="6 6"
            />
            <line
              x1={(drag.origin.x + 0.5) * CELL}
              y1={(drag.origin.y + 0.5) * CELL}
              x2={(drag.hover.x + 0.5) * CELL}
              y2={(drag.hover.y + 0.5) * CELL}
              stroke={dragValid ? "var(--color-accent)" : "var(--color-danger)"}
              strokeWidth="3"
              strokeDasharray="8 6"
              strokeLinecap="round"
            />
            <rect
              x={drag.hover.x * CELL + 3}
              y={drag.hover.y * CELL + 3}
              width={CELL - 6}
              height={CELL - 6}
              rx="8"
              fill={dragValid ? "oklch(0.7 0.2 302 / 0.25)" : "oklch(0.68 0.19 25 / 0.25)"}
              stroke={dragValid ? "var(--color-accent)" : "var(--color-danger)"}
              strokeWidth="2"
            />
            <g transform={`translate(${(drag.hover.x + 0.5) * CELL} ${drag.hover.y * CELL - 10})`}>
              <rect x="-46" y="-16" width="92" height="22" rx="6" fill="oklch(0.13 0.008 300 / 0.92)" />
              <text textAnchor="middle" y="0" fontSize="12" fontFamily="var(--font-mono)" fill={dragDistance > dragging.stats.speed ? "var(--color-warning)" : "white"}>
                {dragDistance} □ · {(dragDistance * map.cellDistance).toLocaleString("pt-BR")} {map.cellUnit}
              </text>
            </g>
          </g>
        )}

        {tokens.map((token) => (
          <TokenView
            key={token.id}
            token={token}
            selected={token.id === selectedId}
            active={token.id === turnToken?.id}
            onPointerDown={(e) => onTokenDown(e, token)}
          />
        ))}

        <AnimatePresence>
          {fx.map((f) => {
            const token = tokens.find((t) => t.id === f.tokenId);
            if (!token) return null;
            return (
              <motion.text
                key={f.id}
                x={(token.x + 0.5) * CELL}
                textAnchor="middle"
                fontSize="20"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={f.tone === "damage" ? "var(--color-danger)" : "var(--color-success)"}
                stroke="oklch(0.1 0 0)"
                strokeWidth="3"
                paintOrder="stroke"
                initial={{ y: token.y * CELL + 8, opacity: 0, scale: 0.6 }}
                animate={{ y: token.y * CELL - 22, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: token.y * CELL - 40 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                pointerEvents="none"
              >
                {f.text}
              </motion.text>
            );
          })}
        </AnimatePresence>
      </svg>

      <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-lg border border-line bg-surface/90 backdrop-blur">
        <MapButton label="Aproximar" onClick={() => zoomBy(1 / 1.25)}>
          <Plus className="size-4" />
        </MapButton>
        <MapButton label="Afastar" onClick={() => zoomBy(1.25)}>
          <Minus className="size-4" />
        </MapButton>
        <MapButton label="Enquadrar mapa" onClick={() => setView(full)}>
          <Maximize2 className="size-3.5" />
        </MapButton>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-canvas/80 px-2 py-1 text-[11px] text-fg-subtle backdrop-blur">
        {map.name} · 1 □ = {map.cellDistance.toLocaleString("pt-BR")} {map.cellUnit} · arraste o fundo para mover, role para zoom
      </p>
    </div>
  );
}

function TokenView({
  token,
  selected,
  active,
  onPointerDown,
}: {
  token: RoomToken;
  selected: boolean;
  active: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const down = isDown(token);
  const r = CELL * 0.4;
  const pct = token.hp.current / token.hp.max;
  const ring = token.kind === "enemy" ? "oklch(0.68 0.19 25)" : "oklch(0.97 0 0 / 0.85)";
  const hpColor = pct > 0.5 ? "var(--color-success)" : pct > 0.25 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <motion.g
      initial={false}
      animate={{ x: token.x * CELL, y: token.y * CELL }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      onPointerDown={onPointerDown}
      style={{ cursor: down ? "pointer" : "grab" }}
      opacity={down ? 0.5 : 1}
      role="button"
      aria-label={`${token.name}, ${token.hp.current} de ${token.hp.max} PV`}
    >
      {active && (
        <motion.circle
          cx={CELL / 2}
          cy={CELL / 2}
          r={r + 6}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      {selected && <circle cx={CELL / 2} cy={CELL / 2} r={r + 9} fill="oklch(0.6 0.2 302 / 0.18)" stroke="var(--color-accent)" strokeWidth="1.5" />}
      <circle cx={CELL / 2} cy={CELL / 2 + 2} r={r} fill="oklch(0 0 0 / 0.45)" />
      <circle cx={CELL / 2} cy={CELL / 2} r={r} fill={token.color} stroke={ring} strokeWidth="2.5" filter={down ? "grayscale(1)" : undefined} />
      <text x={CELL / 2} y={CELL / 2 + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="white" pointerEvents="none">
        {initials(token.name)}
      </text>
      {token.controller === "bot" && (
        <g transform={`translate(${CELL / 2 + r - 6} ${CELL / 2 - r - 2})`} pointerEvents="none">
          <rect width="16" height="12" rx="3" fill="oklch(0.598 0.257 302)" />
          <text x="8" y="9" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
            BOT
          </text>
        </g>
      )}
      {down && <path d={`M${CELL * 0.3} ${CELL * 0.3}L${CELL * 0.7} ${CELL * 0.7}M${CELL * 0.7} ${CELL * 0.3}L${CELL * 0.3} ${CELL * 0.7}`} stroke="white" strokeWidth="3" strokeLinecap="round" />}
      <rect x={CELL * 0.12} y={CELL - 6} width={CELL * 0.76} height="4" rx="2" fill="oklch(0 0 0 / 0.6)" />
      <rect x={CELL * 0.12} y={CELL - 6} width={CELL * 0.76 * Math.max(0, pct)} height="4" rx="2" fill={hpColor} />
      {(selected || active) && (
        <g transform={`translate(${CELL / 2} ${CELL + 10})`} pointerEvents="none">
          <rect x={-token.name.length * 3.3 - 6} y="-10" width={token.name.length * 6.6 + 12} height="16" rx="4" fill="oklch(0.13 0.008 300 / 0.9)" />
          <text textAnchor="middle" y="2" fontSize="11" fill="white">
            {token.name}
          </text>
        </g>
      )}
    </motion.g>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex size-9 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg">
      {children}
    </button>
  );
}
