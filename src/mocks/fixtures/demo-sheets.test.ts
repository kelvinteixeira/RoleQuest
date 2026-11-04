import { describe, expect, it } from "vitest";
import { combatProfile } from "@/features/combat/model/profile";
import { isValidDamage } from "@/features/combat/model/rules";
import { getBuiltInSystem, isBuiltInSystemId } from "@/features/systems/templates";
import { upgradeDatabase, type MockDatabase } from "@/repositories/mock/database";
import { DEMO_SHEET_IDS } from "./demo-sheets";
import { createSeed } from "./seed";

const seed = createSeed(new Date("2026-11-03T12:00:00Z"));
const byId = new Map(seed.characters.map((c) => [c.id, c]));
const profileOf = (id: string) => {
  const c = byId.get(id)!;
  return combatProfile(getBuiltInSystem(c.systemId as never), c.sheet!, c.level);
};

describe("demo sheets", () => {
  it.each(DEMO_SHEET_IDS)("%s only uses keys its system defines", (id) => {
    const character = byId.get(id);
    expect(character?.sheet).toBeDefined();
    expect(isBuiltInSystemId(character!.systemId)).toBe(true);
    const system = getBuiltInSystem(character!.systemId as never);
    const attributes = new Set(system.attributes.map((a) => a.key));
    const skills = new Set(system.skills.map((s) => s.key));
    const sheet = character!.sheet!;
    for (const key of Object.keys(sheet.attributes)) expect(attributes).toContain(key);
    for (const key of Object.keys(sheet.skills)) expect(skills).toContain(key);
    for (const key of Object.keys(sheet.resources)) expect(system.resources.map((r) => r.key)).toContain(key);
    for (const attack of sheet.combat.attacks) {
      if (attack.attributeKey) expect(attributes).toContain(attack.attributeKey);
      if (attack.skillKey) expect(skills).toContain(attack.skillKey);
    }
    for (const attack of profileOf(id).attacks) expect(isValidDamage(attack.damage)).toBe(true);
  });

  it("D&D party plays like level 5 characters", () => {
    expect(profileOf("ch_isolde")).toMatchObject({ defense: 18, attacks: [{ name: "Espada longa", value: 6, damage: "1d8+3" }, { range: 6 }] });
    expect(profileOf("ch_fen")).toMatchObject({ defense: 15, initiative: 3, attacks: [{ name: "Arco longo", value: 8, damage: "1d8+3", range: 30 }, {}] });
    expect(profileOf("ch_nyx").defense).toBe(12);
  });

  it("other systems use their own scales", () => {
    expect(profileOf("ch_kael")).toMatchObject({ armor: 11, defense: 12, attacks: [{ value: 14, damage: "3d6" }, {}] });
    expect(profileOf("ch_tomas").attacks[0]).toMatchObject({ dice: 2, value: 5 });
    expect(profileOf("ch_celeste").attacks[0]).toMatchObject({ value: 5, damage: "1" });
  });

  it("keeps the card summary in step with the sheet", () => {
    expect(byId.get("ch_tomas")!.resources[0]).toMatchObject({ key: "pv", current: 22, max: 30 });
    expect(byId.get("ch_grom")!.resources[0]).toMatchObject({ key: "hp", current: 31, max: 52 });
  });
});

describe("local database upgrade", () => {
  it("v1 → current fills only characters that were never edited and adds the map library", () => {
    const edited = { ...byId.get("ch_isolde")!, sheet: { ...byId.get("ch_isolde")!.sheet!, privateNotes: "minha" } };
    const untouched = { ...byId.get("ch_grom")!, sheet: undefined };
    const stored = { ...seed, version: 1, characters: [edited, untouched] } as MockDatabase;
    const upgraded = upgradeDatabase(stored)!;
    expect(upgraded.version).toBe(3);
    expect(upgraded.maps).toEqual([]);
    expect(upgraded.characters[0].sheet!.privateNotes).toBe("minha");
    expect(upgraded.characters[1].sheet!.attributes.str).toBe(17);
  });

  it("leaves the current version alone and gives up on unknown ones", () => {
    const current = { ...seed, version: 3 } as MockDatabase;
    expect(upgradeDatabase(current)).toBe(current);
    expect(upgradeDatabase({ ...seed, version: 0 } as MockDatabase)).toBeNull();
  });
});
