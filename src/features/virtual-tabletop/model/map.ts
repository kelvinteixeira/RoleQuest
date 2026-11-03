import { isBlocked, type MapDocument } from "@/features/map/model/map-document";
import type { RoomToken } from "./types";

export type Cell = { x: number; y: number };

export const key = (x: number, y: number) => `${x},${y}`;

/** Preferred starting squares; `freeCellNear` adjusts them to whatever the map allows. */
export const PLAYER_SPAWNS: Cell[] = [
  { x: 4, y: 11 },
  { x: 3, y: 9 },
  { x: 5, y: 9 },
  { x: 2, y: 11 },
  { x: 6, y: 11 },
  { x: 4, y: 7 },
];

export const ENEMY_SPAWNS: Cell[] = [
  { x: 22, y: 12 },
  { x: 23, y: 15 },
  { x: 25, y: 11 },
  { x: 27, y: 13 },
];

/** Chebyshev distance: diagonal steps cost one square, as in most grid RPGs. */
export function gridDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Terrain, water and props decide; see `isBlocked` in the map model. */
export function isWall(map: MapDocument, cell: Cell): boolean {
  return isBlocked(map, cell.x, cell.y);
}

export function occupant(tokens: RoomToken[], cell: Cell, exceptId?: string): RoomToken | undefined {
  return tokens.find((t) => t.id !== exceptId && t.hp.current > 0 && t.x === cell.x && t.y === cell.y);
}

export function canStand(map: MapDocument, tokens: RoomToken[], cell: Cell, tokenId?: string): boolean {
  return !isWall(map, cell) && !occupant(tokens, cell, tokenId);
}

const STEPS: Cell[] = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: dx, y: dy }))).filter((d) => d.x || d.y);

/**
 * Breadth-first path from `mover` to any square adjacent to `target`
 * (Chebyshev 1), avoiding blocked cells and other living tokens. Returns the
 * cells after the start, or null when unreachable.
 */
export function pathToAdjacent(map: MapDocument, tokens: RoomToken[], mover: RoomToken, target: Cell): Cell[] | null {
  const start = { x: mover.x, y: mover.y };
  if (gridDistance(start, target) <= 1) return [];
  const seen = new Map<string, string | null>([[key(start.x, start.y), null]]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const k = key(next.x, next.y);
      if (seen.has(k) || !canStand(map, tokens, next, mover.id)) continue;
      seen.set(k, key(current.x, current.y));
      if (gridDistance(next, target) <= 1) {
        const path: Cell[] = [];
        let cursor: string | null = k;
        while (cursor && cursor !== key(start.x, start.y)) {
          const [x, y] = cursor.split(",").map(Number);
          path.unshift({ x, y });
          cursor = seen.get(cursor) ?? null;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Closest free square to `origin` (spiral search): used to place and rescue tokens. */
export function freeCellNear(map: MapDocument, tokens: RoomToken[], origin: Cell): Cell {
  for (let radius = 0; radius < Math.max(map.cols, map.rows); radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cell = { x: origin.x + dx, y: origin.y + dy };
        if (canStand(map, tokens, cell)) return cell;
      }
    }
  }
  return origin;
}
