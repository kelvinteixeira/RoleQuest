/**
 * MapDocument: a serializable square-tile map. Terrain and elevation are
 * per cell; props (trees, rocks, structures) sit on cells. Pure data — the
 * 3D renderer, the editor and the room's movement rules all read from it.
 */
import { createId } from "@/lib/id";
import type { MapBackground } from "./background";

export type TerrainId =
  | "grass"
  | "forest-floor"
  | "dirt"
  | "sand"
  | "stone"
  | "cave-floor"
  | "shallow-water"
  | "deep-water"
  | "rock"
  | "cave-wall";

export type TerrainKind = "ground" | "water" | "raised";

export interface TerrainDef {
  id: TerrainId;
  label: string;
  kind: TerrainKind;
  /** Top colour (sRGB hex); each cell gets a small deterministic variation. */
  color: string;
  /** Side colour for raised blocks and the visible walls of tall tiles. */
  side: string;
  blocks: boolean;
  /** Water depth below the water line, in world units. */
  depth?: number;
}

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  grass: { id: "grass", label: "Grama", kind: "ground", color: "#6aa84f", side: "#5a4632", blocks: false },
  "forest-floor": { id: "forest-floor", label: "Chão de floresta", kind: "ground", color: "#3f7a3a", side: "#4a3a28", blocks: false },
  dirt: { id: "dirt", label: "Terra", kind: "ground", color: "#9a7448", side: "#6e5236", blocks: false },
  sand: { id: "sand", label: "Areia", kind: "ground", color: "#dcc58c", side: "#a8925e", blocks: false },
  stone: { id: "stone", label: "Pedra", kind: "ground", color: "#9a9ca3", side: "#6d6f76", blocks: false },
  "cave-floor": { id: "cave-floor", label: "Chão de caverna", kind: "ground", color: "#57525e", side: "#3d3943", blocks: false },
  "shallow-water": { id: "shallow-water", label: "Água rasa", kind: "water", color: "#c9b88a", side: "#8f7f5a", blocks: false, depth: 0.18 },
  "deep-water": { id: "deep-water", label: "Água funda", kind: "water", color: "#2f5d6b", side: "#23434e", blocks: true, depth: 0.55 },
  rock: { id: "rock", label: "Rocha (penhasco)", kind: "raised", color: "#8d8778", side: "#6f6a5e", blocks: true },
  "cave-wall": { id: "cave-wall", label: "Parede de caverna", kind: "raised", color: "#4a4552", side: "#35313b", blocks: true },
};

export const TERRAIN_ORDER: TerrainId[] = ["grass", "forest-floor", "dirt", "sand", "stone", "cave-floor", "shallow-water", "deep-water", "rock", "cave-wall"];

/* ---------- Props ---------- */

export type PropCategory = "tree" | "rock" | "plant" | "structure" | "feature";

/** Interactive map pieces, drawn procedurally and with state that changes during play. */
export type FeatureKind = "door" | "gate" | "trap-spikes" | "trap-darts" | "torch" | "brazier";

/** How lit the map is before any light source: daylight, dusk/indoors, or darkness. */
export type Ambient = "bright" | "dim" | "dark";

export const AMBIENT_LABEL: Record<Ambient, string> = { bright: "Dia", dim: "Penumbra", dark: "Escuridão" };

/** A light source: radius in squares. */
export interface LightDef {
  radius: number;
  color: string;
  /** Fire flickers. */
  flicker?: boolean;
}

const FIRE: LightDef = { radius: 5, color: "#ffa04d", flicker: true };

export interface PropDef {
  id: string;
  label: string;
  category: PropCategory;
  /** GLB model; features have none (they are drawn from primitives). */
  file?: string;
  feature?: FeatureKind;
  /** Scale the model so its height (or footprint) matches this many cells. */
  fit: { by: "height" | "width"; size: number };
  blocks: boolean;
  /** Makes an otherwise blocking cell walkable (bridges over water). */
  walkable?: boolean;
  /** Random yaw when placed, so forests don't look copy-pasted. */
  randomYaw?: boolean;
  /** Blocks line of sight (fog of war). Raised terrain and closed doors always do. */
  opaque?: boolean;
  /** Default trap damage. */
  damage?: string;
  /** Lights the squares around it (and lets the party see them in the dark). */
  light?: LightDef;
}

const P = (id: string, label: string, category: PropCategory, file: string, fit: PropDef["fit"], blocks: boolean, extra: Partial<PropDef> = {}): PropDef => ({
  id,
  label,
  category,
  file: `/assets/map/props/${file}.glb`,
  fit,
  blocks,
  randomYaw: category !== "structure",
  ...extra,
});

const F = (id: string, label: string, feature: FeatureKind, extra: Partial<PropDef> = {}): PropDef => ({
  id,
  label,
  category: "feature",
  feature,
  fit: { by: "width", size: 1 },
  blocks: false,
  ...extra,
});

export const PROPS: readonly PropDef[] = [
  P("tree-common", "Árvore frondosa", "tree", "q_CommonTree_1", { by: "height", size: 2.6 }, true),
  P("tree-round", "Árvore redonda", "tree", "q_CommonTree_3", { by: "height", size: 2.4 }, true),
  P("pine", "Pinheiro", "tree", "q_Pine_1", { by: "height", size: 3 }, true),
  P("pine-tall", "Pinheiro alto", "tree", "q_Pine_3", { by: "height", size: 3.4 }, true),
  P("dead-tree", "Árvore morta", "tree", "q_DeadTree_1", { by: "height", size: 2.4 }, true),
  P("twisted-tree", "Árvore retorcida", "tree", "q_TwistedTree_1", { by: "height", size: 2.6 }, true),
  P("oak", "Carvalho", "tree", "tree_oak", { by: "height", size: 2.2 }, true),
  P("palm", "Palmeira", "tree", "tree_palmTall", { by: "height", size: 2.8 }, true),
  P("rock-medium", "Rocha média", "rock", "q_Rock_Medium_1", { by: "width", size: 0.9 }, true),
  P("rock-medium-2", "Rocha arredondada", "rock", "q_Rock_Medium_2", { by: "width", size: 0.9 }, true),
  P("rock-large", "Rochedo", "rock", "rock_largeA", { by: "width", size: 1 }, true),
  P("rock-tall", "Rocha alta", "rock", "rock_tallA", { by: "height", size: 1.4 }, true),
  P("stone-large", "Pedra grande", "rock", "stone_largeB", { by: "width", size: 0.95 }, true),
  P("stone-tall", "Menir", "rock", "stone_tallA", { by: "height", size: 1.5 }, true),
  P("pebbles", "Seixos", "rock", "q_Pebble_Round_1", { by: "width", size: 0.45 }, false),
  P("bush", "Arbusto", "plant", "q_Bush_Common", { by: "width", size: 0.85 }, false),
  P("bush-flowers", "Arbusto florido", "plant", "q_Bush_Common_Flowers", { by: "width", size: 0.85 }, false),
  P("fern", "Samambaia", "plant", "q_Fern_1", { by: "width", size: 0.7 }, false),
  P("plant-big", "Planta grande", "plant", "q_Plant_1_Big", { by: "width", size: 0.8 }, false),
  P("grass-tall", "Capim alto", "plant", "q_Grass_Common_Tall", { by: "width", size: 0.7 }, false),
  P("mushroom", "Cogumelo", "plant", "q_Mushroom_Common", { by: "height", size: 0.35 }, false),
  P("mushrooms-red", "Cogumelos vermelhos", "plant", "mushroom_redGroup", { by: "width", size: 0.55 }, false),
  P("bush-large", "Moita", "plant", "plant_bushLarge", { by: "width", size: 0.9 }, false),
  P("lily", "Vitória-régia", "plant", "lily_large", { by: "width", size: 0.7 }, false),
  P("bridge", "Ponte de madeira", "structure", "bridge_wood", { by: "width", size: 1 }, false, { walkable: true }),
  P("cave-entrance", "Entrada de caverna", "structure", "cliff_cave_rock", { by: "width", size: 1 }, true, { opaque: true }),
  P("log", "Tronco caído", "structure", "log", { by: "width", size: 0.9 }, false),
  P("log-stack", "Pilha de toras", "structure", "log_stack", { by: "width", size: 0.9 }, true),
  P("stump", "Toco", "structure", "stump_old", { by: "width", size: 0.55 }, false),
  P("campfire", "Fogueira", "structure", "campfire_stones", { by: "width", size: 0.7 }, false, { light: FIRE }),
  P("tent", "Barraca", "structure", "tent_detailedOpen", { by: "width", size: 1 }, true),
  P("obelisk", "Obelisco", "structure", "statue_obelisk", { by: "height", size: 1.8 }, true),
  P("column", "Coluna", "structure", "statue_column", { by: "height", size: 1.6 }, true),
  P("fence", "Cerca", "structure", "fence_simple", { by: "width", size: 1 }, true),
  P("sign", "Placa", "structure", "sign", { by: "height", size: 0.8 }, false),
  F("door", "Porta de madeira", "door"),
  F("gate", "Grade de ferro", "gate"),
  F("trap-spikes", "Armadilha de espinhos", "trap-spikes", { damage: "2d6" }),
  F("trap-darts", "Placa de dardos", "trap-darts", { damage: "1d6" }),
  F("torch", "Tocha de parede", "torch", { light: { ...FIRE, radius: 4 } }),
  F("brazier", "Braseiro", "brazier", { blocks: true, light: { ...FIRE, radius: 6, color: "#ff8a3d" } }),
];

export const PROP_BY_ID = new Map(PROPS.map((p) => [p.id, p]));

export const PROP_CATEGORY_LABEL: Record<PropCategory, string> = {
  tree: "Árvores",
  rock: "Rochas",
  plant: "Plantas",
  structure: "Estruturas",
  feature: "Portas e armadilhas",
};

export interface DoorState {
  open: boolean;
  /** Locked doors stay shut until the GM unlocks them. */
  locked: boolean;
}

export interface TrapState {
  /** Hidden traps are invisible to players until triggered or revealed. */
  hidden: boolean;
  /** Armed traps go off when a token steps on them (once; the GM can re-arm). */
  armed: boolean;
  damage: string;
}

export interface PlacedProp {
  id: string;
  propId: string;
  x: number;
  y: number;
  /** Yaw in degrees. */
  rotation: number;
  /** Doors and gates. */
  door?: DoorState;
  /** Traps. */
  trap?: TrapState;
  /** Light sources: false when put out (default lit). */
  lit?: boolean;
}

/** The light a placed prop gives right now, if any. */
export const lightOf = (p: PlacedProp): LightDef | null => {
  const light = PROP_BY_ID.get(p.propId)?.light;
  return light && p.lit !== false ? light : null;
};

/** Props the GM can select at the table: doors, traps and light sources. */
export const isInteractive = (p: PlacedProp) => {
  const def = PROP_BY_ID.get(p.propId);
  return !!(def?.feature || def?.light);
};

export const isDoorKind = (kind: FeatureKind | undefined) => kind === "door" || kind === "gate";
export const isTrapKind = (kind: FeatureKind | undefined) => kind === "trap-spikes" || kind === "trap-darts";

/** State a freshly placed feature starts with. */
export function initialFeatureState(def: PropDef | undefined): Pick<PlacedProp, "door" | "trap"> {
  if (isDoorKind(def?.feature)) return { door: { open: false, locked: false } };
  if (isTrapKind(def?.feature)) return { trap: { hidden: true, armed: true, damage: def?.damage ?? "1d6" } };
  return {};
}

export const doorOf = (p: PlacedProp): DoorState | null => (isDoorKind(PROP_BY_ID.get(p.propId)?.feature) ? (p.door ?? { open: false, locked: false }) : null);

export const trapOf = (p: PlacedProp): TrapState | null =>
  isTrapKind(PROP_BY_ID.get(p.propId)?.feature) ? (p.trap ?? { hidden: true, armed: true, damage: PROP_BY_ID.get(p.propId)?.damage ?? "1d6" }) : null;

/** The interactive feature (door, gate or trap) on a cell, if any. */
export function featureAt(doc: MapDocument, x: number, y: number): PlacedProp | undefined {
  return doc.props.find((p) => p.x === x && p.y === y && isInteractive(p));
}

/** GM-only note pinned to a square (never shown to players). */
export interface MapNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

export const NOTE_MAX = 80;

/* ---------- Document ---------- */

export const MAX_ELEVATION = 4;
export const MAP_LIMITS = { min: 8, max: 64 } as const;

export interface MapDocument {
  id: string;
  name: string;
  cols: number;
  rows: number;
  cellDistance: number;
  cellUnit: string;
  /** Row-major, length cols × rows. */
  terrain: TerrainId[];
  /** Row-major elevation levels 0..MAX_ELEVATION. */
  elevation: number[];
  props: PlacedProp[];
  /** Ambient light; missing on older maps = daylight. */
  ambient?: Ambient;
  /** Imported picture under the grid. */
  background?: MapBackground;
  /** GM notes layer. */
  notes?: MapNote[];
}

export const cellIndex = (doc: Pick<MapDocument, "cols">, x: number, y: number) => y * doc.cols + x;
export const inBounds = (doc: Pick<MapDocument, "cols" | "rows">, x: number, y: number) => x >= 0 && y >= 0 && x < doc.cols && y < doc.rows;

export function createBlankMap(cols = 30, rows = 20, base: TerrainId = "grass", name = "Novo mapa"): MapDocument {
  return {
    id: createId("map"),
    name,
    cols,
    rows,
    cellDistance: 1.5,
    cellUnit: "m",
    terrain: Array(cols * rows).fill(base),
    elevation: Array(cols * rows).fill(0),
    props: [],
  };
}

export function terrainAt(doc: MapDocument, x: number, y: number): TerrainDef {
  return TERRAINS[doc.terrain[cellIndex(doc, x, y)]];
}

export function propsAt(doc: MapDocument, x: number, y: number): PlacedProp[] {
  return doc.props.filter((p) => p.x === x && p.y === y);
}

/**
 * Movement rule: out of bounds, blocking terrain, blocking props and closed
 * doors stop tokens; bridges override water.
 */
export function isBlocked(doc: MapDocument, x: number, y: number): boolean {
  if (!inBounds(doc, x, y)) return true;
  const placed = propsAt(doc, x, y);
  if (placed.some((p) => doorOf(p)?.open === false)) return true;
  const here = placed.map((p) => PROP_BY_ID.get(p.propId)).filter(Boolean) as PropDef[];
  if (here.some((p) => p.walkable)) return false;
  if (terrainAt(doc, x, y).blocks) return true;
  return here.some((p) => p.blocks);
}

/** Opaque squares per map document (documents are immutable: every change makes a new one). */
const opacityCache = new WeakMap<MapDocument, Uint8Array>();

function opacityOf(doc: MapDocument): Uint8Array {
  let opaque = opacityCache.get(doc);
  if (!opaque) {
    opaque = new Uint8Array(doc.cols * doc.rows);
    for (let i = 0; i < opaque.length; i++) if (TERRAINS[doc.terrain[i]]?.kind === "raised") opaque[i] = 1;
    for (const p of doc.props) {
      if (!inBounds(doc, p.x, p.y)) continue;
      const def = PROP_BY_ID.get(p.propId);
      if (def?.feature === "door" ? !doorOf(p)!.open : def?.opaque) opaque[cellIndex(doc, p.x, p.y)] = 1;
    }
    opacityCache.set(doc, opaque);
  }
  return opaque;
}

/** Sight rule (fog of war): raised terrain, opaque props and closed wooden doors. Water and gates let sight through. */
export function blocksSight(doc: MapDocument, x: number, y: number): boolean {
  if (!inBounds(doc, x, y)) return true;
  return opacityOf(doc)[cellIndex(doc, x, y)] === 1;
}

/** Resizes keeping the top-left content; new cells use `fill`. */
export function resizeMap(doc: MapDocument, cols: number, rows: number, fill: TerrainId = "grass"): MapDocument {
  const terrain: TerrainId[] = [];
  const elevation: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const inside = x < doc.cols && y < doc.rows;
      terrain.push(inside ? doc.terrain[cellIndex(doc, x, y)] : fill);
      elevation.push(inside ? doc.elevation[cellIndex(doc, x, y)] : 0);
    }
  }
  return { ...doc, cols, rows, terrain, elevation, props: doc.props.filter((p) => p.x < cols && p.y < rows), notes: doc.notes?.filter((n) => n.x < cols && n.y < rows) };
}

/** Deterministic 0..1 noise per cell, used for colour/height jitter and scatter. */
export function cellNoise(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
