import { beforeEach, describe, expect, it } from "vitest";
import { createBlankMap } from "@/features/map/model/map-document";
import { eraseCells, placeNote, placeProps } from "@/features/map/model/shapes";
import { toolLocked, useMapEditorStore } from "./map-editor.store";

const editor = () => useMapEditorStore.getState();

describe("GM notes", () => {
  it("pin one note per square, replace it, and remove it with empty text", () => {
    let m = placeNote(createBlankMap(8, 8), { x: 2, y: 3 }, "  Baú com 40 PO  ");
    expect(m.notes).toMatchObject([{ x: 2, y: 3, text: "Baú com 40 PO" }]);
    m = placeNote(m, { x: 2, y: 3 }, "Baú vazio");
    expect(m.notes!.map((n) => n.text)).toEqual(["Baú vazio"]);
    expect(placeNote(m, { x: 2, y: 3 }, " ").notes).toEqual([]);
    expect(placeNote(m, { x: 20, y: 3 }, "fora")).toBe(m);
  });
});

describe("eraser and layer locks", () => {
  const base = () => placeNote(placeProps({ ...createBlankMap(4, 4, "stone") }, [{ x: 1, y: 1 }], ["tree-common"]), { x: 1, y: 1 }, "nota");

  it("clears every layer by default", () => {
    const m = eraseCells(base(), [{ x: 1, y: 1 }]);
    expect([m.terrain[5], m.props.length, m.notes!.length]).toEqual(["grass", 0, 0]);
  });

  it("leaves locked layers alone", () => {
    const m = eraseCells(base(), [{ x: 1, y: 1 }], "grass", { terrain: true, notes: true });
    expect([m.terrain[5], m.props.length, m.notes!.length]).toEqual(["stone", 0, 1]);
  });
});

describe("editor layers", () => {
  beforeEach(() => {
    editor().open(createBlankMap(6, 6, "stone"));
    for (const id of ["terrain", "props", "notes"] as const) if (editor().layers[id].locked) editor().toggleLayer(id, "locked");
  });

  it("tools do nothing on a locked layer", () => {
    editor().set({ tool: "terrain", shape: "brush", terrain: "sand", brushSize: 1 });
    editor().toggleLayer("terrain", "locked");
    expect(toolLocked("terrain", editor().layers)).toBe(true);
    expect(toolLocked("raise", editor().layers)).toBe(true);
    expect(toolLocked("props", editor().layers)).toBe(false);
    editor().beginStroke({ x: 1, y: 1 });
    editor().endStroke();
    expect(editor().draft!.terrain[7]).toBe("stone");
    expect(editor().dirty).toBe(false);
  });

  it("the note tool pins the typed text in one click", () => {
    editor().set({ tool: "note", noteText: "Emboscada aqui" });
    editor().beginStroke({ x: 4, y: 2 });
    editor().endStroke();
    expect(editor().draft!.notes).toMatchObject([{ x: 4, y: 2, text: "Emboscada aqui" }]);
    editor().undo();
    expect(editor().draft!.notes ?? []).toEqual([]);
  });

  it("a slider drag is one undo step; a no-op note click is none", () => {
    const start = editor().draft!;
    for (const name of ["a", "b", "c"]) editor().replace({ ...editor().draft!, name }, "bg-offset-x");
    expect(editor().past).toHaveLength(1);
    editor().undo();
    expect(editor().draft!.name).toBe(start.name);

    editor().open(createBlankMap(6, 6, "stone"));
    editor().set({ tool: "note", noteText: "" });
    editor().beginStroke({ x: 1, y: 1 });
    expect([editor().past.length, editor().dirty]).toEqual([0, false]);
  });

  it("the eraser keeps hidden layers", () => {
    editor().replace(placeNote(placeProps(editor().draft!, [{ x: 2, y: 2 }], ["bush"]), { x: 2, y: 2 }, "nota"));
    editor().toggleLayer("props", "visible");
    editor().set({ tool: "erase", shape: "brush", brushSize: 1 });
    editor().beginStroke({ x: 2, y: 2 });
    editor().endStroke();
    expect(editor().draft!.props).toHaveLength(1);
    expect(editor().draft!.notes).toEqual([]);
  });

  it("opening the editor resets the layers", () => {
    editor().toggleLayer("props", "locked");
    editor().open(createBlankMap(6, 6));
    expect(editor().layers.props).toEqual({ visible: true, locked: false });
  });

  it("the eraser is locked only when every layer is", () => {
    const layers = editor().layers;
    expect(toolLocked("erase", { ...layers, terrain: { visible: true, locked: true }, props: { visible: true, locked: true } })).toBe(false);
    expect(toolLocked("erase", { ...layers, terrain: { visible: true, locked: true }, props: { visible: true, locked: true }, notes: { visible: true, locked: true } })).toBe(false);
    expect(
      toolLocked("erase", { ...layers, terrain: { visible: true, locked: true }, props: { visible: true, locked: true }, spawns: { visible: true, locked: true }, notes: { visible: true, locked: true } }),
    ).toBe(true);
  });
});
