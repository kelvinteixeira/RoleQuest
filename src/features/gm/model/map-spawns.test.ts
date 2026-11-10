import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { createBlankMap, type MapSpawn } from "@/features/map/model/map-document";
import { playerMapOf } from "@/features/virtual-tabletop/sync/views";
import { spawnTokens } from "./map-spawns";

const rules = DEFAULT_RULES;

const wolf = (id: string, x: number, y: number): MapSpawn => ({
  id,
  x,
  y,
  name: "Lobo",
  concept: "Fera",
  modelId: "wolf",
  color: "#ef4444",
  attitude: "hostile",
  stats: { hp: 11, defense: 13, attackBonus: 4, damage: "2d4+2", speed: 8, initiativeBonus: 2, attackName: "Mordida" },
});

describe("spawnTokens", () => {
  it("turns placed characters into tokens on their squares; hostile ones join the enemies", () => {
    const map = { ...createBlankMap(10, 10), spawns: [wolf("a", 2, 3), { ...wolf("b", 5, 5), name: "Guarda", modelId: "warrior", attitude: "ally" as const }] };
    const tokens = spawnTokens(map, null, rules, []);
    expect(tokens.map((t) => [t.name, t.kind, t.x, t.y, t.modelId])).toEqual([
      ["Lobo", "enemy", 2, 3, "wolf"],
      ["Guarda", "npc", 5, 5, "warrior"],
    ]);
  });

  it("does not bring back characters that were already on the table's map", () => {
    const map = { ...createBlankMap(10, 10), spawns: [wolf("a", 2, 3), wolf("b", 4, 4)] };
    expect(spawnTokens(map, { spawns: [wolf("a", 2, 3)] }, rules, []).map((t) => t.x)).toEqual([4]);
  });

  it("moves a character off an occupied square", () => {
    const map = { ...createBlankMap(10, 10), spawns: [wolf("a", 2, 3), wolf("b", 2, 3)] };
    const [first, second] = spawnTokens(map, null, rules, []);
    expect([first.x, first.y]).toEqual([2, 3]);
    expect([second.x, second.y]).not.toEqual([2, 3]);
  });

  it("keeps placed characters out of the map players receive", () => {
    const map = { ...createBlankMap(4, 4), spawns: [wolf("a", 1, 1)] };
    expect(playerMapOf(map).spawns).toBeUndefined();
  });
});
