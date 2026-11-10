import { describe, expect, it } from "vitest";
import { BLUEPRINTS, buildStructure } from "./buildings";
import { createBlankMap, isBlocked, propsAt, terrainAt, type MapDocument } from "./map-document";
import { castleMap, villageMap } from "./templates";

const propIds = (m: MapDocument) => m.props.map((p) => p.propId);

describe("buildStructure", () => {
  it("builds a house: walls on the outline, a closed door in the south wall, the square inside the door free", () => {
    const m = buildStructure(createBlankMap(12, 12), "house", { x: 2, y: 2 }, { x: 7, y: 7 });
    expect(terrainAt(m, 2, 2).id).toBe("wood-wall");
    expect(terrainAt(m, 7, 4).id).toBe("wood-wall");
    expect(terrainAt(m, 4, 4).id).toBe("wood-floor");
    const door = propsAt(m, 4, 7).find((p) => p.propId === "door");
    expect(door?.door).toEqual({ open: false, locked: false });
    expect(isBlocked(m, 4, 7)).toBe(true);
    expect(propsAt(m, 4, 6)).toEqual([]);
    expect(propIds(m)).toEqual(expect.arrayContaining(["bed", "chest", "table", "chair"]));
  });

  it("changes nothing when the lot is smaller than the blueprint's minimum", () => {
    const blank = createBlankMap(20, 20);
    for (const bp of BLUEPRINTS) {
      expect(buildStructure(blank, bp.id, { x: 0, y: 0 }, { x: bp.min.w - 2, y: bp.min.h - 1 })).toBe(blank);
    }
  });

  it("builds every blueprint at its minimum size without leaving props on walls", () => {
    for (const bp of BLUEPRINTS) {
      const m = buildStructure(createBlankMap(20, 20), bp.id, { x: 1, y: 1 }, { x: bp.min.w, y: bp.min.h });
      // Ruins may come out bare (rubble is scattered); everything else has at least its door or well.
      if (bp.id !== "ruins") expect(m.props.length, bp.id).toBeGreaterThan(0);
      for (const p of m.props) expect(terrainAt(m, p.x, p.y).kind, `${bp.id}: ${p.propId}`).not.toBe("raised");
    }
  });

  it("clears what was on the lot: old props and placed characters go, notes stay", () => {
    let m = createBlankMap(12, 12);
    m = { ...m, props: [{ id: "p", propId: "pine", x: 3, y: 3, rotation: 0 }], notes: [{ id: "n", x: 3, y: 3, text: "baú" }] };
    m = { ...m, spawns: [{ id: "s", x: 4, y: 4, name: "Lobo", concept: "", modelId: "wolf", color: "#f00", attitude: "hostile", stats: { hp: 11, defense: 13, attackBonus: 4, damage: "2d4+2", speed: 8, initiativeBonus: 2 } }] };
    const built = buildStructure(m, "ruins", { x: 2, y: 2 }, { x: 8, y: 8 }, 3);
    expect(built.props.some((p) => p.propId === "pine")).toBe(false);
    expect(built.spawns).toEqual([]);
    expect(built.notes).toHaveLength(1);
  });

  it("raises castle towers above the curtain wall and puts a portcullis in the south wall", () => {
    const m = buildStructure(createBlankMap(30, 30), "castle", { x: 2, y: 2 }, { x: 18, y: 18 });
    const level = (x: number, y: number) => m.elevation[y * m.cols + x];
    expect(level(2, 2)).toBeGreaterThan(level(10, 2));
    expect(propsAt(m, 10, 18).map((p) => p.propId)).toEqual(["gate"]);
    expect(propIds(m)).toContain("throne");
  });
});

describe("starter maps with buildings", () => {
  it("the village has townsfolk and every building's door", () => {
    const m = villageMap();
    expect(m.spawns?.length).toBeGreaterThanOrEqual(3);
    expect(propIds(m).filter((id) => id === "door").length).toBeGreaterThanOrEqual(6);
    expect(propIds(m)).toEqual(expect.arrayContaining(["well", "stall", "altar", "counter", "fence"]));
  });

  it("the castle map has a throne room and guards at the gate", () => {
    const m = castleMap();
    expect(propIds(m)).toContain("throne");
    expect(m.spawns?.map((s) => s.name)).toEqual(["Guarda", "Guarda"]);
  });
});
