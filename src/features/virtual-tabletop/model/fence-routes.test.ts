import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { DEFAULT_NPC_STATS, npcToken } from "@/features/gm/model/npc";
import { buildStructure } from "@/features/map/model/buildings";
import { createBlankMap } from "@/features/map/model/map-document";
import { routeTo } from "./map";

const walker = (x: number, y: number) => npcToken({ id: "n", name: "Guarda", concept: "", attitude: "ally", portraitColor: "#fff", stats: DEFAULT_NPC_STATS }, DEFAULT_RULES, { x, y });

describe("walking around fences", () => {
  it("goes round a fence instead of through it", () => {
    const m = { ...createBlankMap(8, 8), props: [1, 2, 3, 4, 5].map((x) => ({ id: `f${x}`, propId: "fence", x, y: 3, rotation: 0 })) };
    const path = routeTo(m, [], walker(3, 3), { x: 3, y: 4 })!;
    expect(path.at(-1)).toEqual({ x: 3, y: 4 });
    expect(path.length).toBeGreaterThan(1);
  });

  it("enters the farm only through its gate", () => {
    const m = buildStructure(createBlankMap(14, 14), "farm", { x: 3, y: 3 }, { x: 9, y: 9 });
    const empty = { ...m, props: m.props.filter((p) => p.propId.startsWith("fence")) };
    const path = routeTo(empty, [], walker(1, 6), { x: 4, y: 6 })!;
    // In through the gap in the south line (x = 6, between y = 10 and y = 9).
    const inside = (c: { x: number; y: number }) => c.x >= 3 && c.x <= 9 && c.y >= 3 && c.y <= 9;
    const i = path.findIndex(inside);
    expect(path[i]).toEqual({ x: 6, y: 9 });
    expect(path[i - 1]).toEqual({ x: 6, y: 10 });
  });

  it("has no way into a yard fenced all round", () => {
    const m = buildStructure(createBlankMap(14, 14), "farm", { x: 3, y: 3 }, { x: 9, y: 9 });
    const sealed = { ...m, props: [...m.props.filter((p) => p.propId.startsWith("fence")), { id: "gate", propId: "fence", x: 6, y: 9, rotation: 0 }] };
    expect(routeTo(sealed, [], walker(1, 6), { x: 4, y: 6 })).toBeNull();
  });
});
