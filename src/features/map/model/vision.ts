/**
 * Line of sight on the square grid, for the fog of war. Pure functions:
 * the room engine uses them to grow what the party has explored, the 3D
 * view to decide what each viewer currently sees.
 */
import { blocksSight, cellIndex, inBounds, type MapDocument } from "./map-document";
import type { Cell } from "./shapes";

/** Vision radius when the GM has not set one, in squares. */
export const DEFAULT_VISION = 8;

/**
 * True when nothing opaque stands strictly between the two cells
 * (Bresenham). The end cell itself may be opaque: you see the wall.
 */
export function hasLineOfSight(doc: MapDocument, from: Cell, to: Cell): boolean {
  let { x, y } = from;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === to.x && y === to.y) return true;
    if ((x !== from.x || y !== from.y) && blocksSight(doc, x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Cell indices visible from `origin` within a round `radius`. */
export function visibleFrom(doc: MapDocument, origin: Cell, radius: number): number[] {
  const out: number[] = [];
  const r2 = (radius + 0.5) ** 2;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const cell = { x: origin.x + dx, y: origin.y + dy };
      if (inBounds(doc, cell.x, cell.y) && hasLineOfSight(doc, origin, cell)) out.push(cellIndex(doc, cell.x, cell.y));
    }
  }
  return out;
}

/** Union of what several viewers see. */
export function visibleFromAll(doc: MapDocument, viewers: Cell[], radius: number): Set<number> {
  const seen = new Set<number>();
  for (const v of viewers) for (const i of visibleFrom(doc, v, radius)) seen.add(i);
  return seen;
}
