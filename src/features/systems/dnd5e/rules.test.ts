import { describe, expect, it } from "vitest";
import { dnd5e } from "@/features/systems/templates/fantasy";
import { resolveCheck } from "@/features/character-sheet/model/checks";
import { combatProfile } from "@/features/combat/model/profile";
import type { CharacterSheet } from "@/types/character";
import { armorClass, buildSheet, changeRace, hitPointMax, passivePerception, raceBonusOf, saveBonus, skillPicks, spellcasting, syncDerived, type DndChoices } from "./rules";
import { spellSlots } from "./srd";

const fighter: DndChoices = {
  race: "anao-da-colina",
  raceChoices: [],
  class: "guerreiro",
  background: "acolito",
  baseScores: { str: 15, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
  skills: ["atletismo", "percepcao"],
  armor: "cota-de-malha",
  shield: true,
};

describe("D&D 5e (SRD) character creation", () => {
  it("applies racial increases, skills from class, race and background, the class attack and full HP", () => {
    const sheet = buildSheet(dnd5e, fighter);
    // Hill dwarf: CON +2, WIS +1.
    expect(sheet.attributes).toMatchObject({ str: 15, con: 16, wis: 14 });
    expect(["atletismo", "percepcao", "intuicao", "religiao"].every((k) => sheet.skills[k].trained)).toBe(true);
    expect(sheet.skills.furtividade.trained).toBe(false);
    expect(sheet.combat.attacks[0]).toMatchObject({ name: "Espada longa", attributeKey: "str", damage: "1d8+@mod" });
    // d10 + CON 3 + dwarven toughness 1.
    expect(sheet.resources.hp).toEqual({ current: 14, max: 14 });
    // Dwarves walk 25 ft: 5 squares.
    expect(sheet.combat.speed).toBe(5);
    expect(sheet.abilities.map((a) => a.name)).toContain("Retomar o fôlego");
    expect(sheet.custom.background).toBe("Acólito");
  });

  it("half-elves pick two +1s (not Charisma) and two extra skills", () => {
    expect(raceBonusOf("meio-elfo", ["dex", "con", "wis"])).toEqual({ cha: 2, dex: 1, con: 1 });
    expect(skillPicks({ race: "meio-elfo", class: "ladino", background: "personalizado" })).toBe(4 + 2 + 2);
  });

  it("changing race undoes the old increases", () => {
    const sheet = buildSheet(dnd5e, fighter);
    const elf = changeRace(sheet, "alto-elfo");
    expect(elf.attributes).toMatchObject({ con: 14, wis: 13, dex: 14, int: 9 });
    expect(elf.combat.speed).toBe(6);
  });
});

describe("D&D 5e derived values", () => {
  const sheet = buildSheet(dnd5e, fighter);

  it("saving throws add proficiency only for the class's two saves", () => {
    expect(saveBonus(dnd5e, sheet, 1, "str")).toBe(2 + 2);
    expect(saveBonus(dnd5e, sheet, 1, "con")).toBe(3 + 2);
    expect(saveBonus(dnd5e, sheet, 1, "dex")).toBe(1);
    const roll = resolveCheck(dnd5e, sheet, 1, { attributeKey: "con", save: true }, () => 10);
    expect(roll.label).toBe("Resistência de Constituição");
    expect(roll.result.total).toBe(15);
  });

  it("armor class: heavy armor ignores DEX, shields add 2, unarmored defense for barbarians and monks", () => {
    expect(armorClass(sheet)).toMatchObject({ value: 18, untrained: false });
    expect(combatProfile(dnd5e, sheet, 1).defense).toBe(18);
    const barbarian = buildSheet(dnd5e, { ...fighter, class: "barbaro", armor: "nenhuma", shield: false });
    expect(armorClass(barbarian).value).toBe(10 + 1 + 3);
    const monk: CharacterSheet = buildSheet(dnd5e, { ...fighter, class: "monge", armor: "nenhuma", shield: true });
    // A monk with a shield loses unarmored defense.
    expect(armorClass(monk).value).toBe(10 + 1 + 2);
    const wizardInPlate = buildSheet(dnd5e, { ...fighter, class: "mago", armor: "placas", shield: false });
    expect(armorClass(wizardInPlate).untrained).toBe(true);
  });

  it("hit points grow with level and follow CON when auto is on", () => {
    expect(hitPointMax(sheet, 1)).toBe(14);
    // Levels 2-5: 6 (average d10) + 3 + 1 each.
    expect(hitPointMax(sheet, 5)).toBe(14 + 4 * 10);
    const leveled = syncDerived(sheet, 5);
    expect(leveled.resources.hp).toEqual({ current: 54, max: 54 });
    expect(leveled.resources.hit_dice.max).toBe(5);
    expect(syncDerived(leveled, 5)).toBe(leveled);
    const manual = { ...sheet, autoDerived: false };
    expect(syncDerived(manual, 5)).toBe(manual);
  });

  it("passive perception and spellcasting", () => {
    expect(passivePerception(dnd5e, sheet, 1)).toBe(10 + 2 + 2);
    expect(spellcasting(dnd5e, sheet, 1)).toBeNull();
    const wizard = buildSheet(dnd5e, { ...fighter, race: "alto-elfo", class: "mago", baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } });
    // INT 16 (+3), proficiency +2.
    expect(spellcasting(dnd5e, wizard, 1)).toMatchObject({ ability: "int", dc: 13, attack: 5, slots: [2] });
    expect(wizard.resources.spell_slots.max).toBe(2);
  });

  it("spell slot tables: full, half and pact casters", () => {
    expect(spellSlots("full", 5)).toEqual([4, 3, 2]);
    expect(spellSlots("half", 1)).toEqual([]);
    expect(spellSlots("half", 5)).toEqual([4, 2]);
    expect(spellSlots("pact", 1)).toEqual([1]);
    expect(spellSlots("pact", 11)).toEqual([0, 0, 0, 0, 3]);
  });
});
