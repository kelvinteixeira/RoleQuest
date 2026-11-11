import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { templateToken } from "@/features/gm/model/map-spawns";
import { DEFAULT_NPC_STATS, npcToken } from "@/features/gm/model/npc";
import { createBlankMap, paintWall } from "./footprint.fixtures";
import { MONSTER_PRESETS, TIER_ORDER } from "@/features/map-editor/model/spawn-presets";
import { CHARACTER_MODEL_BY_ID, MONSTER_MODELS, sizeOf } from "./character-models";
import { anchorFor, canStand, covers, footprint, freeCellNear, gridDistance, occupant, pathToAdjacent, routeTo } from "./map";
import { attacksInReach } from "./room-engine";
import type { RoomToken } from "./types";

const token = (id: string, x: number, y: number, size?: number, extra: Partial<RoomToken> = {}): RoomToken => ({
  ...npcToken({ id, name: id, concept: "", attitude: "hostile", portraitColor: "#f00", modelId: "warrior", stats: DEFAULT_NPC_STATS }, DEFAULT_RULES, { x, y }),
  id,
  ...(size ? { size } : {}),
  ...extra,
});

describe("large creatures on the grid", () => {
  it("cover a block of squares from their north-west one", () => {
    const dragon = token("dragon", 4, 4, 3);
    expect(footprint(dragon, 3)).toHaveLength(9);
    expect(covers(dragon, { x: 6, y: 6 })).toBe(true);
    expect(covers(dragon, { x: 7, y: 6 })).toBe(false);
    expect(occupant([dragon], { x: 5, y: 6 })?.id).toBe("dragon");
    expect(anchorFor({ x: 5, y: 5 }, 3)).toEqual({ x: 4, y: 4 });
    expect(anchorFor({ x: 5, y: 5 }, 2)).toEqual({ x: 5, y: 5 });
  });

  it("take their size from the token, else from the body, else one square", () => {
    expect(sizeOf(token("a", 0, 0))).toBe(1);
    expect(sizeOf(token("a", 0, 0, undefined, { modelId: "dragon-evolved" }))).toBe(3);
    expect(sizeOf(token("a", 0, 0, 4, { modelId: "dragon-evolved" }))).toBe(4);
    expect(sizeOf({ size: 99, modelId: "warrior" })).toBe(4);
  });

  it("nobody stands inside them, and they need every square free", () => {
    const map = createBlankMap(12, 12);
    const ogre = token("ogre", 4, 4, 2);
    const hero = token("hero", 8, 4);
    const tokens = [ogre, hero];
    expect(canStand(map, tokens, { x: 5, y: 5 }, hero.id)).toBe(false);
    expect(canStand(map, tokens, { x: 6, y: 5 }, hero.id)).toBe(true);
    // The ogre fits beside the hero, not over him, and not off the map.
    expect(canStand(map, tokens, { x: 6, y: 4 }, ogre.id)).toBe(true);
    expect(canStand(map, tokens, { x: 7, y: 4 }, ogre.id)).toBe(false);
    expect(canStand(map, tokens, { x: 11, y: 4 }, ogre.id)).toBe(false);
    // It may shuffle onto squares it already covers.
    expect(canStand(map, tokens, { x: 5, y: 4 }, ogre.id)).toBe(true);
  });

  it("measure distance from their edges, so reach works all around them", () => {
    const dragon = token("dragon", 4, 4, 3);
    expect(gridDistance(token("h", 7, 5), dragon)).toBe(1);
    expect(gridDistance(token("h", 3, 3), dragon)).toBe(1);
    expect(gridDistance(token("h", 9, 6), dragon)).toBe(3);
    expect(gridDistance(dragon, token("giant", 8, 4, 2))).toBe(2);
    expect(gridDistance({ x: 1, y: 1 }, { x: 4, y: 3 })).toBe(3);
    const hero = token("h", 7, 6);
    expect(attacksInReach(hero, dragon).length).toBeGreaterThan(0);
    expect(attacksInReach(token("far", 9, 9), dragon)).toHaveLength(0);
  });

  it("do not fit through gaps narrower than themselves", () => {
    // A wall across the map with a one-square door and, further on, a two-square gate.
    const map = paintWall(createBlankMap(14, 10), 5, [{ from: 2, to: 2 }, { from: 6, to: 7 }]);
    const hero = token("hero", 1, 2);
    const ogre = token("ogre", 1, 1, 2);
    expect(routeTo(map, [hero], hero, { x: 9, y: 2 })).toHaveLength(8);
    const way = routeTo(map, [ogre], ogre, { x: 9, y: 1 })!;
    expect(way).not.toBeNull();
    // Through the gate (rows 6–7), never through the door.
    expect(way.find((c) => c.x === 5)).toEqual({ x: 5, y: 6 });
    const sealed = paintWall(createBlankMap(14, 10), 5, [{ from: 2, to: 2 }]);
    expect(routeTo(sealed, [ogre], ogre, { x: 9, y: 1 })).toBeNull();
  });

  it("are placed where the whole block fits, and bots close in on their edge", () => {
    const map = paintWall(createBlankMap(14, 10), 5, []);
    const spot = freeCellNear(map, [], { x: 4, y: 4 }, 3);
    expect(footprint(spot, 3).every((c) => c.x < 5)).toBe(true);
    const dragon = token("dragon", 8, 3, 3);
    const hero = token("hero", 12, 9);
    const path = pathToAdjacent(createBlankMap(14, 10), [dragon, hero], hero, dragon)!;
    expect(gridDistance(path.at(-1)!, dragon)).toBe(1);
  });
});

describe("the bestiary", () => {
  it("covers every size, with a body that exists for each monster", () => {
    for (const tier of TIER_ORDER) expect(MONSTER_PRESETS.some((m) => m.tier === tier), tier).toBe(true);
    expect(new Set(MONSTER_PRESETS.map((m) => m.key)).size).toBe(MONSTER_PRESETS.length);
    for (const m of MONSTER_PRESETS) expect(CHARACTER_MODEL_BY_ID.has(m.modelId), m.key).toBe(true);
    expect(MONSTER_PRESETS.find((m) => m.key === "ancient-dragon")?.size).toBe(4);
  });

  it("ships the model file of every monster body", () => {
    for (const m of MONSTER_MODELS) expect(existsSync(join(process.cwd(), "public", m.file)), m.file).toBe(true);
  });

  it("puts a monster on the table at its size, numbering repeats", () => {
    const map = createBlankMap(20, 20);
    const ogre = MONSTER_PRESETS.find((m) => m.key === "ogre")!;
    const first = templateToken(ogre, map, DEFAULT_RULES, [], { x: 5, y: 5 });
    const second = templateToken(ogre, map, DEFAULT_RULES, [first], { x: 5, y: 5 });
    expect([first.name, first.size, first.kind]).toEqual(["Ogro", 2, "enemy"]);
    expect(second.name).toBe("Ogro 2");
    expect(footprint(second, 2).some((c) => covers(first, c))).toBe(false);
  });
});
