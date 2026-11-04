/**
 * Geometric shapes rasterised onto the square grid, and the edit
 * operations that apply them to a MapDocument. Pure functions.
 */
import { createId } from "@/lib/id";
import {
  cellIndex,
  cellNoise,
  inBounds,
  initialFeatureState,
  isDoorKind,
  MAX_ELEVATION,
  PROP_BY_ID,
  terrainAt,
  TERRAINS,
  type MapDocument,
  type PlacedProp,
  type TerrainId,
} from "./map-document";

export type Cell = { x: number; y: number };
export type ShapeKind = "brush" | "rect" | "rect-outline" | "ellipse" | "line";

const key = (c: Cell) => `${c.x},${c.y}`;

function dedupe(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  return cells.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true)));
}

/** Square brush of side `size` centred on the cell. */
export function brushCells(center: Cell, size: number): Cell[] {
  const r = Math.floor(size / 2);
  const out: Cell[] = [];
  for (let dy = -r; dy <= size - 1 - r; dy++) for (let dx = -r; dx <= size - 1 - r; dx++) out.push({ x: center.x + dx, y: center.y + dy });
  return out;
}

export function rectCells(a: Cell, b: Cell, outline = false): Cell[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (!outline || x === x0 || x === x1 || y === y0 || y === y1) out.push({ x, y });
  return out;
}

/** Filled ellipse inscribed in the rectangle a–b (a circle when square). */
export function ellipseCells(a: Cell, b: Cell): Cell[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2 + 0.5;
  const ry = (y1 - y0) / 2 + 0.5;
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) out.push({ x, y });
  return out;
}

/** Bresenham line thickened with a square brush — rivers, roads, walls. */
export function lineCells(a: Cell, b: Cell, width = 1): Cell[] {
  const out: Cell[] = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push(...brushCells({ x, y }, width));
    if (x === b.x && y === b.y) break;
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
  return dedupe(out);
}

export function shapeCells(kind: ShapeKind, a: Cell, b: Cell, size: number): Cell[] {
  switch (kind) {
    case "brush":
      return brushCells(b, size);
    case "rect":
      return rectCells(a, b);
    case "rect-outline":
      return rectCells(a, b, true);
    case "ellipse":
      return ellipseCells(a, b);
    case "line":
      return lineCells(a, b, size);
  }
}

/** Contiguous cells with the same terrain and elevation (4-neighbour flood fill). */
export function floodCells(doc: MapDocument, start: Cell): Cell[] {
  if (!inBounds(doc, start.x, start.y)) return [];
  const i0 = cellIndex(doc, start.x, start.y);
  const terrain = doc.terrain[i0];
  const level = doc.elevation[i0];
  const seen = new Set<number>([i0]);
  const queue: Cell[] = [start];
  const out: Cell[] = [];
  while (queue.length) {
    const c = queue.pop()!;
    out.push(c);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (!inBounds(doc, n.x, n.y)) continue;
      const i = cellIndex(doc, n.x, n.y);
      if (seen.has(i) || doc.terrain[i] !== terrain || doc.elevation[i] !== level) continue;
      seen.add(i);
      queue.push(n);
    }
  }
  return out;
}

/* ---------- Edit operations (return a new document) ---------- */

const inside = (doc: MapDocument, cells: Cell[]) => cells.filter((c) => inBounds(doc, c.x, c.y));

export function paintTerrain(doc: MapDocument, cells: Cell[], terrain: TerrainId): MapDocument {
  const next = [...doc.terrain];
  const valid = inside(doc, cells);
  for (const c of valid) next[cellIndex(doc, c.x, c.y)] = terrain;
  // Water and raised rock cannot hold plants or loose rocks: clear non-walkable props there.
  const kind = TERRAINS[terrain].kind;
  const cleared = new Set(valid.map(key));
  const props = kind === "ground" ? doc.props : doc.props.filter((p) => !cleared.has(key(p)) || PROP_BY_ID.get(p.propId)?.walkable || p.propId === "lily");
  return { ...doc, terrain: next, props };
}

export function shiftElevation(doc: MapDocument, cells: Cell[], delta: number): MapDocument {
  const next = [...doc.elevation];
  for (const c of inside(doc, cells)) {
    const i = cellIndex(doc, c.x, c.y);
    next[i] = Math.max(0, Math.min(MAX_ELEVATION, next[i] + delta));
  }
  return { ...doc, elevation: next };
}

const wallAt = (doc: MapDocument, x: number, y: number) => !inBounds(doc, x, y) || terrainAt(doc, x, y).blocks;

/** Doors face the passage: walls east and west → the door spans east–west (0°); walls north and south → 90°. */
export function doorYaw(doc: MapDocument, cell: Cell): number {
  const eastWest = Number(wallAt(doc, cell.x - 1, cell.y)) + Number(wallAt(doc, cell.x + 1, cell.y));
  const northSouth = Number(wallAt(doc, cell.x, cell.y - 1)) + Number(wallAt(doc, cell.x, cell.y + 1));
  return northSouth > eastWest ? 90 : 0;
}

/**
 * Places one prop per cell (replacing what was there). `density` < 1 scatters
 * randomly, e.g. forests. Doors and traps start closed / hidden and armed.
 */
export function placeProps(doc: MapDocument, cells: Cell[], propIds: string[], density = 1, seed = 0): MapDocument {
  if (propIds.length === 0) return doc;
  const targets = inside(doc, cells).filter((c, i) => density >= 1 || cellNoise(c.x, c.y, seed + i) < density);
  const taken = new Set(targets.map(key));
  const kept = doc.props.filter((p) => !taken.has(key(p)));
  const added: PlacedProp[] = targets.map((c) => {
    const pick = propIds[Math.floor(cellNoise(c.x, c.y, seed + 7) * propIds.length)];
    const def = PROP_BY_ID.get(pick);
    return {
      id: createId("prop"),
      propId: pick,
      x: c.x,
      y: c.y,
      rotation: def?.randomYaw ? Math.floor(cellNoise(c.x, c.y, seed + 13) * 360) : isDoorKind(def?.feature) ? doorYaw(doc, c) : 0,
      ...initialFeatureState(def),
    };
  });
  return { ...doc, props: [...kept, ...added] };
}

/** Rotates the props on a cell by 90°. */
export function rotatePropsAt(doc: MapDocument, cell: Cell): MapDocument {
  return { ...doc, props: doc.props.map((p) => (p.x === cell.x && p.y === cell.y ? { ...p, rotation: (p.rotation + 90) % 360 } : p)) };
}

/** Eraser: back to base ground, level 0, no props. */
export function eraseCells(doc: MapDocument, cells: Cell[], base: TerrainId = "grass"): MapDocument {
  const valid = inside(doc, cells);
  const set = new Set(valid.map(key));
  const terrain = [...doc.terrain];
  const elevation = [...doc.elevation];
  for (const c of valid) {
    const i = cellIndex(doc, c.x, c.y);
    terrain[i] = base;
    elevation[i] = 0;
  }
  return { ...doc, terrain, elevation, props: doc.props.filter((p) => !set.has(key(p))) };
}

export function removeProps(doc: MapDocument, cells: Cell[]): MapDocument {
  const set = new Set(cells.map(key));
  return { ...doc, props: doc.props.filter((p) => !set.has(key(p))) };
}
