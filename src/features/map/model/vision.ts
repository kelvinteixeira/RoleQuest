/**
 * Line of sight on the square grid, for the fog of war. Pure functions:
 * the room engine uses them to grow what the party has explored, the 3D
 * view to decide what each viewer currently sees.
 */
import { blocksSight, cellIndex, inBounds, lightOf, type Ambient, type MapDocument } from "./map-document";
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

export interface LightSource extends Cell {
  radius: number;
}

/** Light sources placed on the map that are burning. */
export function mapLights(doc: MapDocument): LightSource[] {
  return doc.props.flatMap((p) => {
    const light = lightOf(p);
    return light ? [{ x: p.x, y: p.y, radius: light.radius }] : [];
  });
}

/** How far a viewer sees by itself, without any light: all of its vision by day, a little at dusk, its own square and neighbours in the dark. */
export function unaidedSight(ambient: Ambient | undefined, vision: number): number {
  return ambient === "dark" ? 1 : ambient === "dim" ? Math.min(vision, 3) : vision;
}

/** Squares reached by some light (with line of sight from the light). */
export function litCells(doc: MapDocument, lights: LightSource[]): Set<number> {
  const lit = new Set<number>();
  for (const l of lights) for (const i of visibleFrom(doc, l, l.radius)) lit.add(i);
  return lit;
}

/** Squares lit by the map's own fires, cached per document (it changes only when the map does). */
const mapLitCache = new WeakMap<MapDocument, Set<number>>();

export function mapLitCells(doc: MapDocument): Set<number> {
  let lit = mapLitCache.get(doc);
  if (!lit) {
    lit = litCells(doc, mapLights(doc));
    mapLitCache.set(doc, lit);
  }
  return lit;
}

/**
 * What viewers see under the map's lighting: anything in line of sight
 * within `vision`, as long as it is close enough to see unaided or lit (by
 * the map's fires or by `carried` lights).
 */
export function visibleInLight(doc: MapDocument, viewers: Cell[], vision: number, carried: LightSource[] = []): Set<number> {
  const unaided = unaidedSight(doc.ambient, vision);
  if (unaided >= vision) return visibleFromAll(doc, viewers, vision);
  const fixed = mapLitCells(doc);
  const lit = carried.length ? new Set([...fixed, ...litCells(doc, carried)]) : fixed;
  const seen = new Set<number>();
  const r2 = (unaided + 0.5) ** 2;
  for (const v of viewers) {
    for (const i of visibleFrom(doc, v, vision)) {
      const dx = (i % doc.cols) - v.x;
      const dy = Math.floor(i / doc.cols) - v.y;
      if (dx * dx + dy * dy <= r2 || lit.has(i)) seen.add(i);
    }
  }
  return seen;
}

/** Union of what several viewers see. */
export function visibleFromAll(doc: MapDocument, viewers: Cell[], radius: number): Set<number> {
  const seen = new Set<number>();
  for (const v of viewers) for (const i of visibleFrom(doc, v, radius)) seen.add(i);
  return seen;
}
