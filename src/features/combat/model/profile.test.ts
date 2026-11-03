import { describe, expect, it } from "vitest";
import { checkValue, resolveCheck } from "@/features/character-sheet/model/checks";
import { createSheet, ensureSheet } from "@/features/character-sheet/model/sheet";
import { getBuiltInSystem } from "@/features/systems/templates";
import { scriptedRng } from "@/test/rng";
import type { Character, CharacterSheet } from "@/types/character";
import { attackStats, combatProfile, deriveDefense, resolveDamageFormula } from "./profile";

const dnd = getBuiltInSystem("dnd5e");
const t20 = getBuiltInSystem("tormenta20");
const coc = getBuiltInSystem("call-of-cthulhu");
const gurps = getBuiltInSystem("gurps");

function withAttributes(sheet: CharacterSheet, attributes: Record<string, number>): CharacterSheet {
  return { ...sheet, attributes: { ...sheet.attributes, ...attributes } };
}

describe("combat profile from a sheet", () => {
  it("D&D: attack = STR mod + proficiency, damage adds the modifier, defense = 10 + DEX mod", () => {
    const sheet = withAttributes(createSheet(dnd), { str: 16, dex: 14 });
    const profile = combatProfile(dnd, sheet, 1);
    expect(profile.attacks[0]).toMatchObject({ value: 5, damage: "1d8+3", range: 1 });
    expect(profile.defense).toBe(12);
    expect(profile.initiative).toBe(2);
  });

  it("D&D: a negative modifier keeps the damage formula valid", () => {
    const sheet = withAttributes(createSheet(dnd), { str: 8 });
    expect(combatProfile(dnd, sheet, 1).attacks[0].damage).toBe("1d8-1");
  });

  it("D&D: a manual defense overrides the derived one", () => {
    const sheet = createSheet(dnd);
    expect(combatProfile(dnd, { ...sheet, combat: { ...sheet.combat, defense: 18 } }, 1).defense).toBe(18);
  });

  it("Tormenta20: the default attack uses Luta and its training bonus", () => {
    const sheet = createSheet(t20);
    const attack = sheet.combat.attacks[0];
    expect(attack.skillKey).toBe("luta");
    const trained: CharacterSheet = { ...withAttributes(sheet, { for: 3 }), skills: { ...sheet.skills, luta: { trained: true, bonus: 0 } } };
    expect(attackStats(t20, trained, 1, attack)).toMatchObject({ value: 5, damage: "1d8+3" });
  });

  it("Call of Cthulhu: attacks use the fighting skill %, defense is Esquivar", () => {
    const sheet = createSheet(coc);
    const skillKey = sheet.combat.attacks[0].skillKey!;
    const edited = { ...sheet, skills: { ...sheet.skills, [skillKey]: { trained: false, bonus: 45 } } };
    expect(combatProfile(coc, edited, null).attacks[0].value).toBe(45);
    expect(deriveDefense(coc, edited)).toBe(20);
  });

  it("GURPS: skill target and dodge from DX and HT", () => {
    const sheet = createSheet(gurps);
    const profile = combatProfile(gurps, sheet, null);
    expect(profile.attacks[0].value).toBe(10);
    expect(profile.defense).toBe(8);
  });

  it("older sheets without a combat block get the default attack", () => {
    const legacy: Partial<CharacterSheet> = createSheet(dnd);
    delete legacy.combat;
    const character = { sheet: legacy, resources: [] } as unknown as Character;
    expect(ensureSheet(character, dnd).combat.attacks).toHaveLength(1);
  });
});

describe("damage placeholders", () => {
  const sheet = withAttributes(createSheet(dnd), { str: 6, dex: 18 });
  it.each([
    ["2d6+@mod", "str", "2d6-2"],
    ["1d6 + @mod", "dex", "1d6+4"],
    ["1d6+@value", null, "1d6"],
    ["@mod", "dex", "4"],
  ])("%s with %s → %s", (damage, attributeKey, expected) => {
    expect(resolveDamageFormula(dnd, sheet, { damage, attributeKey })).toBe(expected);
  });
});

describe("checks keep their values after the refactor", () => {
  it("D&D skill: modifier + proficiency by level + bonus", () => {
    const sheet = withAttributes(createSheet(dnd), { str: 16 });
    const trained = { ...sheet, skills: { ...sheet.skills, atletismo: { trained: true, bonus: 1 } } };
    expect(checkValue(dnd, trained, 5, { skillKey: "atletismo" }).value).toBe(7);
    expect(resolveCheck(dnd, trained, 5, { skillKey: "atletismo" }, scriptedRng(10)).result.total).toBe(17);
  });

  it("Call of Cthulhu skill is its own target", () => {
    const sheet = createSheet(coc);
    expect(resolveCheck(coc, sheet, null, { skillKey: "esquivar" }, scriptedRng(1, 2)).label).toContain("alvo 20");
  });
});
