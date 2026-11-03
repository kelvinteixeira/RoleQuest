import type { RoomMap, RoomToken } from "./types";

export type Cell = { x: number; y: number };

export const key = (x: number, y: number) => `${x},${y}`;

/**
 * Starter scene until the tile editor exists (Phase 3): a vault with an
 * entry hall on the left, a partition wall with two doorways and pillars.
 */
export function createStarterMap(): RoomMap {
  const cols = 26;
  const rows = 18;
  const walls = new Set<string>();
  for (let x = 0; x < cols; x++) {
    walls.add(key(x, 0));
    walls.add(key(x, rows - 1));
  }
  for (let y = 0; y < rows; y++) {
    walls.add(key(0, y));
    walls.add(key(cols - 1, y));
  }
  // Partition between hall and vault, with two doorways.
  for (let y = 1; y < rows - 1; y++) if (![4, 5, 12, 13].includes(y)) walls.add(key(9, y));
  // Pillars in the vault.
  for (const [x, y] of [[13, 5], [13, 12], [18, 5], [18, 12], [21, 8], [21, 9]]) walls.add(key(x, y));
  return { name: "Cofre sob o bazar", cols, rows, cellDistance: 1.5, cellUnit: "m", walls: [...walls] };
}

export const PLAYER_SPAWNS: Cell[] = [
  { x: 3, y: 7 },
  { x: 3, y: 10 },
  { x: 5, y: 8 },
  { x: 2, y: 9 },
  { x: 5, y: 11 },
  { x: 6, y: 6 },
];

/** Chebyshev distance: diagonal steps cost one square, as in most grid RPGs. */
export function gridDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isWall(map: RoomMap, cell: Cell): boolean {
  return cell.x < 0 || cell.y < 0 || cell.x >= map.cols || cell.y >= map.rows || map.walls.includes(key(cell.x, cell.y));
}

export function occupant(tokens: RoomToken[], cell: Cell, exceptId?: string): RoomToken | undefined {
  return tokens.find((t) => t.id !== exceptId && t.hp.current > 0 && t.x === cell.x && t.y === cell.y);
}

export function canStand(map: RoomMap, tokens: RoomToken[], cell: Cell, tokenId?: string): boolean {
  return !isWall(map, cell) && !occupant(tokens, cell, tokenId);
}

const STEPS: Cell[] = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: dx, y: dy }))).filter((d) => d.x || d.y);

/**
 * Breadth-first path from `from` to any square adjacent to `target`
 * (Chebyshev 1), avoiding walls and other living tokens. Returns the cells
 * after `from`, or null when unreachable.
 */
export function pathToAdjacent(map: RoomMap, tokens: RoomToken[], mover: RoomToken, target: Cell): Cell[] | null {
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

/** Free squares around a cell, closest first: used to place new tokens. */
export function freeCellNear(map: RoomMap, tokens: RoomToken[], origin: Cell): Cell {
  for (let radius = 0; radius < Math.max(map.cols, map.rows); radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const cell = { x: origin.x + dx, y: origin.y + dy };
        if (canStand(map, tokens, cell)) return cell;
      }
    }
  }
  return origin;
}
