import { canCross, isBlocked, type MapDocument } from "@/features/map/model/map-document";
import { lineCells } from "@/features/map/model/shapes";
import { sizeOf } from "./character-models";
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

/** Something on the grid: a square, or a creature covering `size` × `size` squares from its north-west one. */
export type Spot = Cell & { size?: number; modelId?: string };

const side = (s: Spot) => (s.size === undefined && s.modelId === undefined ? 1 : sizeOf(s));

/** Every square a creature of `size` covers when its north-west square is `cell`. */
export function footprint(cell: Cell, size = 1): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) out.push({ x: cell.x + dx, y: cell.y + dy });
  return out;
}

/** Does the creature cover this square? */
export function covers(token: Spot, cell: Cell): boolean {
  const s = side(token);
  return cell.x >= token.x && cell.y >= token.y && cell.x < token.x + s && cell.y < token.y + s;
}

/** The north-west square that puts a creature of `size` centred on `cell` (where the pointer is). */
export function anchorFor(cell: Cell, size: number): Cell {
  const shift = Math.floor((size - 1) / 2);
  return { x: cell.x - shift, y: cell.y - shift };
}

/**
 * Chebyshev distance: diagonal steps cost one square, as in most grid RPGs.
 * Between large creatures it is the gap between their edges, so a dragon is
 * "adjacent" to everyone standing around it.
 */
export function gridDistance(a: Spot, b: Spot): number {
  const [sa, sb] = [side(a), side(b)];
  const dx = Math.max(0, b.x - (a.x + sa - 1), a.x - (b.x + sb - 1));
  const dy = Math.max(0, b.y - (a.y + sa - 1), a.y - (b.y + sb - 1));
  return Math.max(dx, dy);
}

/** Terrain, water and props decide; see `isBlocked` in the map model. */
export function isWall(map: MapDocument, cell: Cell): boolean {
  return isBlocked(map, cell.x, cell.y);
}

export function occupant(tokens: RoomToken[], cell: Cell, exceptId?: string): RoomToken | undefined {
  return tokens.find((t) => t.id !== exceptId && t.hp.current > 0 && covers(t, cell));
}

/**
 * Can a creature stand with its north-west square on `cell`? Every square it
 * covers must be free. `size` defaults to that of the token named by `tokenId`.
 */
export function canStand(map: MapDocument, tokens: RoomToken[], cell: Cell, tokenId?: string, size?: number): boolean {
  const mover = tokenId ? tokens.find((t) => t.id === tokenId) : undefined;
  const s = size ?? (mover ? sizeOf(mover) : 1);
  return footprint(cell, s).every((c) => !isWall(map, c) && !occupant(tokens, c, tokenId));
}

/** A step is open when no fence stops any square of the creature. */
function canStep(map: MapDocument, from: Cell, to: Cell, size: number): boolean {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  return footprint(from, size).every((c) => canCross(map, c, { x: c.x + dx, y: c.y + dy }));
}

const STEPS: Cell[] = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: dx, y: dy }))).filter((d) => d.x || d.y);

/**
 * Breadth-first path from `mover` to the first cell that satisfies `goal`,
 * avoiding blocked cells and other living tokens. Returns the cells after the
 * start, or null when unreachable.
 */
function findPath(map: MapDocument, tokens: RoomToken[], mover: RoomToken, goal: (cell: Cell) => boolean): Cell[] | null {
  const start = { x: mover.x, y: mover.y };
  const size = sizeOf(mover);
  if (goal(start)) return [];
  const seen = new Map<string, string | null>([[key(start.x, start.y), null]]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const k = key(next.x, next.y);
      if (seen.has(k) || !canStand(map, tokens, next, mover.id, size) || !canStep(map, current, next, size)) continue;
      seen.set(k, key(current.x, current.y));
      if (goal(next)) {
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

/** Path to where the mover touches `target` (edge to edge): how bots close in to attack. */
export function pathToAdjacent(map: MapDocument, tokens: RoomToken[], mover: RoomToken, target: Spot): Cell[] | null {
  const size = sizeOf(mover);
  return findPath(map, tokens, mover, (c) => gridDistance({ ...c, size }, target) <= 1);
}

/**
 * The squares a token crosses to reach `target`: the straight line when it is
 * clear, otherwise the shortest way around. Null when there is no way.
 */
export function routeTo(map: MapDocument, tokens: RoomToken[], mover: RoomToken, target: Cell): Cell[] | null {
  const line = lineCells({ x: mover.x, y: mover.y }, target);
  const straight = line.slice(1);
  const size = sizeOf(mover);
  // Clear squares all the way, and no fence across any step.
  if (straight.every((c, i) => canStand(map, tokens, c, mover.id, size) && canStep(map, line[i], c, size))) return straight;
  return findPath(map, tokens, mover, (c) => c.x === target.x && c.y === target.y);
}

/** Closest free square to `origin` (spiral search): used to place and rescue tokens. */
export function freeCellNear(map: MapDocument, tokens: RoomToken[], origin: Cell, size = 1): Cell {
  for (let radius = 0; radius < Math.max(map.cols, map.rows); radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cell = { x: origin.x + dx, y: origin.y + dy };
        if (canStand(map, tokens, cell, undefined, size)) return cell;
      }
    }
  }
  return origin;
}
