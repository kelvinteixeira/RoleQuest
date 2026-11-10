import { create } from "zustand";
import { PROP_BY_ID, SCATTER_CATEGORIES, type MapDocument, type SpawnTemplate, type TerrainId } from "@/features/map/model/map-document";
import { BLUEPRINT_BY_ID, buildStructure, type BlueprintId } from "@/features/map/model/buildings";
import {
  eraseCells,
  floodCells,
  paintTerrain,
  ellipseCells,
  placeNote,
  placeProps,
  placeSpawn,
  rectCells,
  rotatePropsAt,
  shapeCells,
  shiftElevation,
  type Cell,
  type ShapeKind,
} from "@/features/map/model/shapes";

export type EditorTool = "terrain" | "props" | "build" | "spawn" | "raise" | "lower" | "erase" | "rotate" | "note";

/** Editor layers: what is shown while editing and what tools may change. */
export type LayerId = "background" | "terrain" | "props" | "spawns" | "notes";
export type LayerState = Record<LayerId, { visible: boolean; locked: boolean }>;

const DEFAULT_LAYERS: LayerState = {
  background: { visible: true, locked: false },
  terrain: { visible: true, locked: false },
  props: { visible: true, locked: false },
  spawns: { visible: true, locked: false },
  notes: { visible: true, locked: false },
};

/** The layer a tool changes (the eraser changes every unlocked one; buildings change terrain and objects). */
export const TOOL_LAYER: Record<Exclude<EditorTool, "erase" | "build">, LayerId> = {
  terrain: "terrain",
  spawn: "spawns",
  raise: "terrain",
  lower: "terrain",
  props: "props",
  rotate: "props",
  note: "notes",
};

/** True when the current tool has nothing it may change. */
export function toolLocked(tool: EditorTool, layers: LayerState): boolean {
  if (tool === "erase") return layers.terrain.locked && layers.props.locked && layers.spawns.locked && layers.notes.locked;
  if (tool === "build") return layers.terrain.locked || layers.props.locked;
  return layers[TOOL_LAYER[tool]].locked;
}
export type EditorShape = ShapeKind | "fill";

const HISTORY_LIMIT = 60;

type Stroke = { anchor: Cell; current: Cell; painted: Set<string> };

type MapEditorState = {
  /** Working copy; the room map only changes when the GM applies it. */
  draft: MapDocument | null;
  past: MapDocument[];
  future: MapDocument[];
  dirty: boolean;
  tool: EditorTool;
  shape: EditorShape;
  terrain: TerrainId;
  propIds: string[];
  brushSize: number;
  density: number;
  noteText: string;
  blueprint: BlueprintId;
  /** The character the "spawn" tool places. */
  spawn: SpawnTemplate | null;
  layers: LayerState;
  stroke: Stroke | null;
  /** Key of the last coalesced change (slider drags make one undo step, not one per tick). */
  coalesce: string | null;

  open: (doc: MapDocument) => void;
  close: () => void;
  /** `coalesce`: consecutive changes with the same key share one undo step. */
  replace: (doc: MapDocument, coalesce?: string) => void;
  set: (patch: Partial<Pick<MapEditorState, "tool" | "shape" | "terrain" | "propIds" | "brushSize" | "density" | "noteText" | "blueprint" | "spawn">>) => void;
  toggleLayer: (id: LayerId, key: "visible" | "locked") => void;
  undo: () => void;
  redo: () => void;
  beginStroke: (cell: Cell) => void;
  moveStroke: (cell: Cell) => void;
  endStroke: () => void;
  previewCells: () => Cell[];
};

/** Tools that paint continuously while dragging (instead of a shape released on pointer up). Buildings are always dragged as a lot. */
const isContinuous = (s: Pick<MapEditorState, "shape" | "tool">) => (s.shape === "brush" && s.tool !== "build") || s.tool === "rotate";

/** Single-click tools: one square, one change. */
const isClick = (tool: EditorTool) => tool === "note" || tool === "spawn";

/** The squares a building will cover (an ellipse for round blueprints). */
export function blueprintCells(id: BlueprintId, a: Cell, b: Cell): Cell[] {
  return BLUEPRINT_BY_ID.get(id)?.round ? ellipseCells(a, b) : rectCells(a, b);
}

type ApplyState = Pick<MapEditorState, "tool" | "terrain" | "propIds" | "density" | "noteText" | "layers" | "spawn">;

function apply(doc: MapDocument, s: ApplyState, cells: Cell[], seed: number): MapDocument {
  switch (s.tool) {
    case "terrain":
      return paintTerrain(doc, cells, s.terrain);
    case "props": {
      // Trees, rocks and plants are scattered; furniture, structures and doors go exactly where they are drawn.
      const scatter = s.propIds.some((id) => SCATTER_CATEGORIES.includes(PROP_BY_ID.get(id)?.category ?? "feature"));
      return placeProps(doc, cells, s.propIds, scatter ? s.density : 1, seed);
    }
    case "raise":
      return shiftElevation(doc, cells, 1);
    case "lower":
      return shiftElevation(doc, cells, -1);
    case "erase":
      // Hidden layers are kept too: the eraser never deletes what the GM cannot see.
      return eraseCells(doc, cells, "grass", {
        terrain: s.layers.terrain.locked,
        props: s.layers.props.locked || !s.layers.props.visible,
        spawns: s.layers.spawns.locked || !s.layers.spawns.visible,
        notes: s.layers.notes.locked || !s.layers.notes.visible,
      });
    case "rotate":
      return cells.reduce((d, c) => rotatePropsAt(d, c), doc);
    case "note":
      return cells[0] ? placeNote(doc, cells[0], s.noteText) : doc;
    case "spawn":
      return cells[0] && s.spawn ? placeSpawn(doc, cells[0], s.spawn) : doc;
    case "build":
      // Built on pointer up from the dragged lot (see endStroke).
      return doc;
  }
}

export const useMapEditorStore = create<MapEditorState>((set, get) => {
  /** Saves the current draft to history before a change. */
  const checkpoint = () => {
    const { draft, past } = get();
    if (draft) set({ past: [...past, draft].slice(-HISTORY_LIMIT), future: [] });
  };

  return {
    draft: null,
    past: [],
    future: [],
    dirty: false,
    tool: "terrain",
    shape: "brush",
    terrain: "grass",
    propIds: ["tree-common", "pine", "tree-round"],
    brushSize: 1,
    density: 0.5,
    noteText: "",
    blueprint: "house",
    spawn: null,
    layers: DEFAULT_LAYERS,
    stroke: null,
    coalesce: null,

    // Every editing session starts with all layers visible and unlocked.
    open: (doc) => set({ draft: structuredClone(doc), past: [], future: [], dirty: false, stroke: null, coalesce: null, layers: DEFAULT_LAYERS }),
    close: () => set({ draft: null, past: [], future: [], dirty: false, stroke: null, coalesce: null }),
    replace: (doc, coalesce) => {
      if (!coalesce || coalesce !== get().coalesce) checkpoint();
      set({ draft: doc, dirty: true, coalesce: coalesce ?? null });
    },
    set: (patch) => set(patch),
    toggleLayer: (id, key) => {
      const layers = get().layers;
      set({ layers: { ...layers, [id]: { ...layers[id], [key]: !layers[id][key] } } });
    },

    undo: () => {
      const { past, draft, future } = get();
      if (!past.length || !draft) return;
      set({ draft: past[past.length - 1], past: past.slice(0, -1), future: [draft, ...future], dirty: true });
    },
    redo: () => {
      const { past, draft, future } = get();
      if (!future.length || !draft) return;
      set({ draft: future[0], future: future.slice(1), past: [...past, draft], dirty: true });
    },

    beginStroke: (cell) => {
      const s = get();
      if (!s.draft || toolLocked(s.tool, s.layers)) return;
      if (isClick(s.tool)) {
        const next = apply(s.draft, s, [cell], 0);
        // Empty text on an empty square (or nothing picked) changes nothing: no undo step, not dirty.
        if (next === s.draft || (s.tool === "note" && JSON.stringify(next.notes ?? []) === JSON.stringify(s.draft.notes ?? []))) return;
        checkpoint();
        set({ draft: next, dirty: true, coalesce: null });
        return;
      }
      checkpoint();
      set({ coalesce: null });
      if (s.shape === "fill" && s.tool !== "build") {
        const cells = s.tool === "rotate" ? [cell] : floodCells(s.draft, cell);
        set({ draft: apply(s.draft, s, cells, Date.now() % 997), dirty: true });
        return;
      }
      const stroke: Stroke = { anchor: cell, current: cell, painted: new Set() };
      set({ stroke });
      if (isContinuous(s)) get().moveStroke(cell);
    },

    moveStroke: (cell) => {
      const s = get();
      if (!s.stroke || !s.draft) return;
      if (!isContinuous(s)) {
        if (s.stroke.current.x !== cell.x || s.stroke.current.y !== cell.y) set({ stroke: { ...s.stroke, current: cell } });
        return;
      }
      // Continuous tools touch each cell once per stroke (raise/lower would otherwise stack).
      const cells = (s.tool === "rotate" ? [cell] : shapeCells("brush", cell, cell, s.brushSize)).filter((c) => !s.stroke!.painted.has(`${c.x},${c.y}`));
      if (cells.length === 0) return;
      cells.forEach((c) => s.stroke!.painted.add(`${c.x},${c.y}`));
      set({ draft: apply(s.draft, s, cells, s.stroke.painted.size), stroke: { ...s.stroke, current: cell }, dirty: true });
    },

    endStroke: () => {
      const s = get();
      if (!s.stroke || !s.draft) return set({ stroke: null });
      if (s.tool === "build") {
        const built = buildStructure(s.draft, s.blueprint, s.stroke.anchor, s.stroke.current, Date.now() % 997);
        // Too small a lot builds nothing: drop the undo step taken on pointer down.
        if (built === s.draft) set({ past: s.past.slice(0, -1) });
        else set({ draft: built, dirty: true });
      } else if (!isContinuous(s) && s.shape !== "fill") {
        const cells = shapeCells(s.shape as ShapeKind, s.stroke.anchor, s.stroke.current, s.brushSize);
        set({ draft: apply(s.draft, s, cells, Date.now() % 997), dirty: true });
      }
      set({ stroke: null });
    },

    previewCells: () => {
      const s = get();
      if (s.stroke && s.tool === "build") return blueprintCells(s.blueprint, s.stroke.anchor, s.stroke.current);
      if (!s.stroke || isContinuous(s) || s.shape === "fill") return [];
      return shapeCells(s.shape as ShapeKind, s.stroke.anchor, s.stroke.current, s.brushSize);
    },
  };
});
