/**
 * Building blueprints: the GM drags a rectangle and gets a whole structure —
 * floor, walls, doors and furniture — made with the editor's own edit
 * operations, so the result can be touched up square by square. Pure functions.
 */
import { cellIndex, cellNoise, inBounds, MAX_ELEVATION, type MapDocument, type TerrainId } from "./map-document";
import { ellipseCells, paintTerrain, placeProps, rectCells, type Cell } from "./shapes";

export type BlueprintId = "house" | "tavern" | "temple" | "tower" | "castle" | "ruins" | "square" | "farm";

/** The dragged area, normalised. */
export interface Lot {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  /** Centre column and row (rounded down). */
  cx: number;
  cy: number;
}

export interface Blueprint {
  id: BlueprintId;
  label: string;
  description: string;
  /** Smallest lot it can be built on (width × height, walls included). */
  min: { w: number; h: number };
  /** Drawn as an ellipse inside the lot (the editor previews it that way). */
  round?: boolean;
  build: (doc: MapDocument, lot: Lot, seed: number) => MapDocument;
}

export function lotOf(a: Cell, b: Cell): Lot {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: Math.floor((x0 + x1) / 2), cy: Math.floor((y0 + y1) / 2) };
}

const key = (c: Cell) => `${c.x},${c.y}`;
const lotCells = (l: Lot) => rectCells({ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 });
const outline = (l: Lot) => rectCells({ x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 }, true);
const inner = (l: Lot): Lot => lotOf({ x: l.x0 + 1, y: l.y0 + 1 }, { x: l.x1 - 1, y: l.y1 - 1 });

/** Sets an exact elevation level (walls rise above the lot's floor). */
function setLevel(doc: MapDocument, cells: Cell[], level: number): MapDocument {
  const elevation = [...doc.elevation];
  const clamped = Math.max(0, Math.min(MAX_ELEVATION, level));
  for (const c of cells) if (inBounds(doc, c.x, c.y)) elevation[cellIndex(doc, c.x, c.y)] = clamped;
  return { ...doc, elevation };
}

/** Clears the lot (props and placed characters; GM notes stay) and levels it to its centre's height. */
function clearSite(doc: MapDocument, lot: Lot): { doc: MapDocument; base: number } {
  const cells = lotCells(lot);
  const set = new Set(cells.map(key));
  const base = doc.elevation[cellIndex(doc, lot.cx, lot.cy)] ?? 0;
  const cleared = { ...doc, props: doc.props.filter((p) => !set.has(key(p))), spawns: doc.spawns?.filter((s) => !set.has(key(s))) };
  return { doc: setLevel(cleared, cells, base), base };
}

const occupied = (doc: MapDocument, c: Cell) => doc.props.some((p) => p.x === c.x && p.y === c.y);

/**
 * One piece of furniture on a free square (skipping the squares that must stay
 * clear, like the one inside a door). `rotation`: 0 faces south, 90 east, 180 north, 270 west.
 */
function put(doc: MapDocument, cell: Cell, propId: string, rotation?: number, clear: Set<string> = new Set()): MapDocument {
  if (!inBounds(doc, cell.x, cell.y) || occupied(doc, cell) || clear.has(key(cell))) return doc;
  const next = placeProps(doc, [cell], [propId]);
  if (rotation === undefined) return next;
  return { ...next, props: next.props.map((p) => (p.x === cell.x && p.y === cell.y ? { ...p, rotation } : p)) };
}

/** Floor everywhere, walls on the outline, a door in the middle of the south wall. */
function walledRoom(doc: MapDocument, lot: Lot, floor: TerrainId, wall: TerrainId, wallRise: number, door: "door" | "gate" = "door") {
  const site = clearSite(doc, lot);
  let m = paintTerrain(site.doc, lotCells(lot), floor);
  const walls = outline(lot);
  m = paintTerrain(m, walls, wall);
  m = setLevel(m, walls, site.base + wallRise);
  const doorCell = { x: lot.cx, y: lot.y1 };
  m = paintTerrain(m, [doorCell], floor);
  m = setLevel(m, [doorCell], site.base);
  m = placeProps(m, [doorCell], [door]);
  // The square just inside the door stays free, or nobody gets in.
  const clear = new Set([key({ x: lot.cx, y: lot.y1 - 1 })]);
  return { doc: m, base: site.base, clear };
}

function house(doc: MapDocument, lot: Lot): MapDocument {
  const room = walledRoom(doc, lot, "wood-floor", "wood-wall", 0);
  const i = inner(lot);
  let m = room.doc;
  m = put(m, { x: i.x0, y: i.y0 }, "bed", 0, room.clear);
  m = put(m, { x: i.x1, y: i.y0 }, "chest", 0, room.clear);
  if (i.w >= 3 && i.h >= 3) {
    const t = { x: i.cx + (i.w % 2 === 0 ? 1 : 0), y: i.cy };
    m = put(m, t, "table", 0, room.clear);
    m = put(m, { x: t.x - 1, y: t.y }, "chair", 90, room.clear);
    m = put(m, { x: t.x + 1, y: t.y }, "chair", 270, room.clear);
  }
  m = put(m, { x: i.x0, y: i.y1 }, "barrel", 0, room.clear);
  m = put(m, { x: i.x1, y: i.y1 }, "crate", 0, room.clear);
  return m;
}

function tavern(doc: MapDocument, lot: Lot): MapDocument {
  const room = walledRoom(doc, lot, "wood-floor", "wood-wall", 0);
  const i = inner(lot);
  let m = room.doc;
  // The bar: kegs against the north wall, the counter in front of them, the hearth in the corner.
  const barLength = Math.min(3, i.w - 2);
  for (let x = i.x0; x < i.x0 + barLength; x++) {
    m = put(m, { x, y: i.y0 }, "barrel", 0, room.clear);
    m = put(m, { x, y: i.y0 + 1 }, "counter", 0, room.clear);
  }
  m = put(m, { x: i.x1, y: i.y0 }, "brazier", 0, room.clear);
  // Tables with a chair on each side, every three squares.
  for (let y = i.y0 + 3; y <= i.y1; y += 3) {
    for (let x = i.x0 + 1; x <= i.x1 - 1; x += 3) {
      if (room.clear.has(key({ x, y }))) continue;
      m = put(m, { x, y }, "table", 0, room.clear);
      m = put(m, { x: x - 1, y }, "chair", 90, room.clear);
      m = put(m, { x: x + 1, y }, "chair", 270, room.clear);
    }
  }
  return m;
}

function temple(doc: MapDocument, lot: Lot): MapDocument {
  const room = walledRoom(doc, lot, "stone", "stone-wall", 1);
  const i = inner(lot);
  let m = paintTerrain(room.doc, rectCells({ x: lot.cx, y: i.y0 + 1 }, { x: lot.cx, y: i.y1 }), "carpet");
  m = put(m, { x: lot.cx, y: i.y0 }, "altar", 0, room.clear);
  m = put(m, { x: lot.cx - 1, y: i.y0 }, "banner", 0, room.clear);
  m = put(m, { x: lot.cx + 1, y: i.y0 }, "banner", 0, room.clear);
  m = put(m, { x: i.x0, y: i.y0 }, "torch", 0, room.clear);
  m = put(m, { x: i.x1, y: i.y0 }, "torch", 0, room.clear);
  if (i.w >= 5) {
    for (let y = i.y0 + 2; y <= i.y1 - 1; y += 2) {
      m = put(m, { x: i.x0, y }, "column", 0, room.clear);
      m = put(m, { x: i.x1, y }, "column", 0, room.clear);
    }
  }
  // Pews on both sides of the aisle, facing the altar.
  const pewX0 = i.w >= 5 ? i.x0 + 1 : i.x0;
  const pewX1 = i.w >= 5 ? i.x1 - 1 : i.x1;
  for (let y = i.y0 + 2; y <= i.y1 - 1; y += 2) for (let x = pewX0; x <= pewX1; x++) if (x !== lot.cx) m = put(m, { x, y }, "bench", 0, room.clear);
  return m;
}

function tower(doc: MapDocument, lot: Lot): MapDocument {
  const site = clearSite(doc, lot);
  const area = ellipseCells({ x: lot.x0, y: lot.y0 }, { x: lot.x1, y: lot.y1 });
  const inArea = new Set(area.map(key));
  const ring = area.filter((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inArea.has(key({ x: c.x + dx, y: c.y + dy }))));
  let m = paintTerrain(site.doc, area, "stone");
  m = paintTerrain(m, ring, "stone-wall");
  m = setLevel(m, ring, site.base + 2);
  const doorY = Math.max(...ring.filter((c) => c.x === lot.cx).map((c) => c.y));
  const doorCell = { x: lot.cx, y: doorY };
  m = paintTerrain(m, [doorCell], "stone");
  m = setLevel(m, [doorCell], site.base);
  m = placeProps(m, [doorCell], ["door"]);
  const clear = new Set([key({ x: lot.cx, y: doorY - 1 })]);
  // A wizard's study: books at the back, a desk in the middle, a light by the door.
  const top = Math.min(...area.filter((c) => c.x === lot.cx && !ring.some((r) => r.x === c.x && r.y === c.y)).map((c) => c.y));
  m = put(m, { x: lot.cx, y: top }, "bookshelf", 0, clear);
  m = put(m, { x: lot.cx, y: lot.cy }, "table", 0, clear);
  m = put(m, { x: lot.cx - 1, y: lot.cy }, "chair", 90, clear);
  m = put(m, { x: lot.cx + 1, y: doorY - 1 }, "torch", 0, clear);
  return m;
}

function castle(doc: MapDocument, lot: Lot): MapDocument {
  const site = clearSite(doc, lot);
  const base = site.base;
  let m = paintTerrain(site.doc, lotCells(lot), "cobblestone");
  // Curtain wall, then taller towers at the corners.
  const walls = outline(lot);
  m = paintTerrain(m, walls, "stone-wall");
  m = setLevel(m, walls, base + 1);
  const towers = [
    rectCells({ x: lot.x0, y: lot.y0 }, { x: lot.x0 + 2, y: lot.y0 + 2 }),
    rectCells({ x: lot.x1 - 2, y: lot.y0 }, { x: lot.x1, y: lot.y0 + 2 }),
    rectCells({ x: lot.x0, y: lot.y1 - 2 }, { x: lot.x0 + 2, y: lot.y1 }),
    rectCells({ x: lot.x1 - 2, y: lot.y1 - 2 }, { x: lot.x1, y: lot.y1 }),
  ].flat();
  m = paintTerrain(m, towers, "stone-wall");
  m = setLevel(m, towers, base + 2);
  // Portcullis in the south wall, torches inside it.
  const gate = { x: lot.cx, y: lot.y1 };
  m = paintTerrain(m, [gate], "cobblestone");
  m = setLevel(m, [gate], base);
  m = placeProps(m, [gate], ["gate"]);
  const clear = new Set([key({ x: lot.cx, y: lot.y1 - 1 })]);
  m = put(m, { x: lot.cx - 1, y: lot.y1 - 1 }, "torch", 0, clear);
  m = put(m, { x: lot.cx + 1, y: lot.y1 - 1 }, "torch", 0, clear);

  // The keep, with the throne room, when there is space for it.
  const keepW = Math.max(5, Math.min(lot.w - 8, Math.floor(lot.w * 0.45) | 1));
  const keepH = Math.max(5, Math.min(lot.h - 9, Math.floor(lot.h * 0.4)));
  if (lot.w >= 13 && lot.h >= 14) {
    const k = lotOf({ x: lot.cx - Math.floor(keepW / 2), y: lot.y0 + 4 }, { x: lot.cx - Math.floor(keepW / 2) + keepW - 1, y: lot.y0 + 4 + keepH - 1 });
    const room = walledRoom(m, k, "stone", "stone-wall", 2);
    m = room.doc;
    const ki = inner(k);
    m = paintTerrain(m, rectCells({ x: k.cx, y: ki.y0 + 1 }, { x: k.cx, y: ki.y1 }), "carpet");
    m = put(m, { x: k.cx, y: ki.y0 }, "throne", 0, room.clear);
    m = put(m, { x: k.cx - 1, y: ki.y0 }, "banner", 0, room.clear);
    m = put(m, { x: k.cx + 1, y: ki.y0 }, "banner", 0, room.clear);
    m = put(m, { x: ki.x0, y: ki.y1 }, "brazier", 0, room.clear);
    m = put(m, { x: ki.x1, y: ki.y1 }, "brazier", 0, room.clear);
    for (const c of [{ x: k.cx, y: k.y1 + 1 }, { x: k.cx, y: k.y1 + 2 }]) clear.add(key(c));
  } else {
    m = put(m, { x: lot.cx, y: lot.cy }, "well", 0, clear);
  }
  // The courtyard's workaday corners.
  m = put(m, { x: lot.x0 + 1, y: lot.y1 - 3 }, "barrel", 0, clear);
  m = put(m, { x: lot.x0 + 1, y: lot.y1 - 4 }, "crate", 0, clear);
  m = put(m, { x: lot.x1 - 1, y: lot.y1 - 3 }, "anvil", 0, clear);
  m = put(m, { x: lot.x1 - 1, y: lot.y1 - 4 }, "haystack", 0, clear);
  m = put(m, { x: lot.cx - 2, y: lot.y1 - 1 }, "banner", 0, clear);
  m = put(m, { x: lot.cx + 2, y: lot.y1 - 1 }, "banner", 0, clear);
  return m;
}

function ruins(doc: MapDocument, lot: Lot, seed: number): MapDocument {
  const site = clearSite(doc, lot);
  let m = site.doc;
  const cells = lotCells(lot);
  // Broken paving: some squares keep whatever ground was there.
  m = paintTerrain(m, cells.filter((c) => cellNoise(c.x, c.y, seed) < 0.45), "cobblestone");
  m = paintTerrain(m, cells.filter((c) => { const n = cellNoise(c.x, c.y, seed); return n >= 0.45 && n < 0.75; }), "stone");
  // Crumbling walls with gaps, a few stretches still standing tall.
  const standing = outline(lot).filter((c) => cellNoise(c.x, c.y, seed + 3) < 0.55);
  m = paintTerrain(m, standing, "stone-wall");
  m = setLevel(m, standing.filter((c) => cellNoise(c.x, c.y, seed + 5) < 0.25), site.base + 1);
  const i = inner(lot);
  if (i.w > 0 && i.h > 0) m = placeProps(m, lotCells(i), ["pebbles", "rock-medium", "stone-large", "column", "stone-tall", "grass-tall"], 0.16, seed + 11);
  return m;
}

function square(doc: MapDocument, lot: Lot): MapDocument {
  const site = clearSite(doc, lot);
  const area = ellipseCells({ x: lot.x0, y: lot.y0 }, { x: lot.x1, y: lot.y1 });
  const inArea = new Set(area.map(key));
  let m = paintTerrain(site.doc, area, "cobblestone");
  const at = (c: Cell, id: string, rot = 0) => (inArea.has(key(c)) ? (m = put(m, c, id, rot)) : m);
  at({ x: lot.cx, y: lot.cy }, "well");
  if (lot.w >= 9 && lot.h >= 9) {
    // Market stalls around the well, facing it, with their goods beside them.
    at({ x: lot.cx, y: lot.y0 + 1 }, "stall", 0);
    at({ x: lot.cx, y: lot.y1 - 1 }, "stall", 180);
    at({ x: lot.x0 + 1, y: lot.cy }, "stall", 90);
    at({ x: lot.x1 - 1, y: lot.cy }, "stall", 270);
    at({ x: lot.cx + 1, y: lot.y0 + 1 }, "crate");
    at({ x: lot.cx - 1, y: lot.y1 - 1 }, "barrel");
    at({ x: lot.x0 + 1, y: lot.cy + 1 }, "crate");
    at({ x: lot.x1 - 1, y: lot.cy - 1 }, "barrel");
  }
  if (lot.h >= 7) {
    at({ x: lot.cx, y: lot.cy - 2 }, "bench");
    at({ x: lot.cx, y: lot.cy + 2 }, "bench");
  }
  if (lot.w >= 7) {
    at({ x: lot.cx - 2, y: lot.cy }, "banner");
    at({ x: lot.cx + 2, y: lot.cy }, "banner");
  }
  return m;
}

function farm(doc: MapDocument, lot: Lot, seed: number): MapDocument {
  const site = clearSite(doc, lot);
  let m = paintTerrain(site.doc, lotCells(lot), "dirt");
  const gate = key({ x: lot.cx, y: lot.y1 });
  for (const c of outline(lot)) {
    if (key(c) === gate) continue;
    const side = (c.x === lot.x0 || c.x === lot.x1) && c.y !== lot.y0 && c.y !== lot.y1;
    m = put(m, c, "fence", side ? 90 : 0);
  }
  const i = inner(lot);
  const clear = new Set([key({ x: lot.cx, y: lot.y1 - 1 })]);
  m = put(m, { x: i.x0, y: i.y0 }, "cart", 90, clear);
  const loose = lotCells(i).filter((c) => !clear.has(key(c)) && !occupied(m, c));
  m = placeProps(m, loose, ["haystack", "haystack", "crate", "barrel"], 0.14, seed);
  return m;
}

export const BLUEPRINTS: readonly Blueprint[] = [
  { id: "house", label: "Casa", description: "Assoalho, paredes de madeira, porta, cama, mesa e baú.", min: { w: 4, h: 4 }, build: house },
  { id: "tavern", label: "Taverna", description: "Balcão com barris, lareira e mesas com cadeiras.", min: { w: 6, h: 6 }, build: tavern },
  { id: "temple", label: "Templo", description: "Altar, tapete, colunas, bancos e tochas.", min: { w: 5, h: 7 }, build: temple },
  { id: "tower", label: "Torre", description: "Torre redonda de pedra com estúdio de mago.", min: { w: 5, h: 5 }, round: true, build: tower },
  { id: "castle", label: "Castelo", description: "Muralha, torres nos cantos, portão de ferro e, se couber, a fortaleza com sala do trono.", min: { w: 11, h: 11 }, build: castle },
  { id: "ruins", label: "Ruínas", description: "Paredes quebradas, piso partido e entulho.", min: { w: 4, h: 4 }, build: ruins },
  { id: "square", label: "Praça", description: "Calçamento com poço e, se couber, barracas de feira.", min: { w: 5, h: 5 }, round: true, build: square },
  { id: "farm", label: "Fazenda", description: "Cercado de terra com feno, caixotes e carroça.", min: { w: 5, h: 5 }, build: farm },
];

export const BLUEPRINT_BY_ID = new Map(BLUEPRINTS.map((b) => [b.id, b]));

export const blueprintFits = (bp: Blueprint, lot: Pick<Lot, "w" | "h">) => lot.w >= bp.min.w && lot.h >= bp.min.h;

/** Builds the blueprint on the lot between two corners; too small a lot changes nothing. */
export function buildStructure(doc: MapDocument, id: BlueprintId, a: Cell, b: Cell, seed = 0): MapDocument {
  const bp = BLUEPRINT_BY_ID.get(id);
  const lot = lotOf(a, b);
  if (!bp || !blueprintFits(bp, lot) || !inBounds(doc, lot.x0, lot.y0) || !inBounds(doc, lot.x1, lot.y1)) return doc;
  return bp.build(doc, lot, seed);
}
