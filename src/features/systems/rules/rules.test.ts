import { describe, expect, it } from "vitest";
import { applyClass, createSheet, ensureSheet } from "@/features/character-sheet/model/sheet";
import { resolveCheck } from "@/features/character-sheet/model/checks";
import { deriveDefense } from "@/features/combat/model/profile";
import { dnd5e, tormenta20 } from "@/features/systems/templates/fantasy";
import { duplicateAsCustom, newClass, pruneReferences, validateSystem } from "@/features/systems/model/system-editor";
import { dndOf, dndRules } from "@/features/systems/dnd5e/rules";
import { t20Rules } from "@/features/systems/tormenta20/rules";
import { createCustomSystem } from "@/features/systems/templates/custom";
import type { Character, CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { buildOf, withBuild } from "./build";
import { genericRules, grownMax, growthHint } from "./generic";
import { rulesFor, syncSheet } from "./registry";

/** A Tormenta20 copy whose group typed in a class: 12 PV at level 1, +3 and CON per level; 4 PM +4 per level. */
function t20WithClass(): SystemTemplate {
  const copy = duplicateAsCustom(tormenta20);
  return {
    ...copy,
    classes: [{ ...newClass("Guerreiro", []), resourceBonus: { pv: 12, pm: 4 }, resourceGrowth: { pv: { perLevel: 3, attributeKey: "con" }, pm: { perLevel: 4 } } }],
  };
}

describe("rules registry", () => {
  it("picks the system's module, the base's for copies, and the generic one for systems made from scratch", () => {
    expect(rulesFor(dnd5e)).toBe(dndRules);
    expect(rulesFor(duplicateAsCustom(dnd5e))).toBe(dndRules);
    expect(rulesFor(duplicateAsCustom(tormenta20))).toBe(t20Rules);
    expect(rulesFor(createCustomSystem({ name: "Brasas", theme: "", primaryDie: "d20" }))).toBe(genericRules);
  });
});

describe("resources that grow with the class", () => {
  const system = t20WithClass();
  const withClass = (con: number): CharacterSheet => {
    const sheet = applyClass(system, createSheet(system), system.classes![0].key);
    return { ...sheet, attributes: { ...sheet.attributes, con } };
  };

  it("max = level-1 value + per level × (level − 1) + attribute × level", () => {
    const cls = system.classes![0];
    expect(grownMax(system, withClass(2), cls, "pv", 1)).toBe(12 + 2);
    expect(grownMax(system, withClass(2), cls, "pv", 5)).toBe(12 + 3 * 4 + 2 * 5);
    expect(grownMax(system, withClass(2), cls, "pm", 5)).toBe(4 + 4 * 4);
    expect(growthHint(system, cls, "pv")).toBe("12 no 1º nível +3 por nível + CON por nível");
  });

  it("the sheet keeps up with level (current moves with the max) unless automatic is off", () => {
    const synced = syncSheet(system, withClass(2), 5);
    expect(synced.resources.pv).toEqual({ current: 34, max: 34 });
    expect(synced.resources.pm.max).toBe(20);
    expect(syncSheet(system, synced, 5)).toBe(synced);
    const manual = { ...withClass(2), autoDerived: false };
    expect(syncSheet(system, manual, 5)).toBe(manual);
    // No class chosen: nothing to follow.
    const plain = createSheet(system);
    expect(syncSheet(system, plain, 5)).toBe(plain);
  });

  it("the system editor checks and prunes the formulas", () => {
    expect(validateSystem(system)).toEqual({});
    const broken: SystemTemplate = { ...system, classes: [{ ...system.classes![0], resourceGrowth: { pv: { perLevel: Number.NaN } } }] };
    expect(validateSystem(broken)["classes.0.resourceGrowth"]).toBeDefined();
    const noCon = pruneReferences({ ...system, attributes: system.attributes.filter((a) => a.key !== "con"), resources: system.resources.filter((r) => r.key !== "pm") });
    expect(noCon.classes![0].resourceGrowth).toEqual({ pv: { perLevel: 3 } });
  });
});

describe("module data on the sheet", () => {
  it("each module reads only its own build", () => {
    const sheet = withBuild(createSheet(dnd5e), "dnd5e", { race: "humano" });
    expect(buildOf<{ race: string }>(sheet, "dnd5e")?.race).toBe("humano");
    expect(buildOf(sheet, "tormenta20")).toBeUndefined();
  });

  it("sheets saved with the old `dnd` field move to `build`, keeping their armor class", () => {
    const legacy: CharacterSheet = {
      ...createSheet(dnd5e),
      dnd: { race: "anao-da-colina", class: "guerreiro", background: "acolito", armor: "cota-de-malha", shield: true, raceBonus: { con: 2, wis: 1 }, auto: false },
    };
    const character = { sheet: legacy, resources: [] } as unknown as Character;
    const migrated = ensureSheet(character, dnd5e);
    expect(migrated.dnd).toBeUndefined();
    expect(dndOf(migrated)).toMatchObject({ class: "guerreiro", armor: "cota-de-malha", shield: true });
    expect(migrated.autoDerived).toBe(false);
    expect(deriveDefense(dnd5e, migrated)).toBe(18);
    // Saving throws still come from the module.
    expect(resolveCheck(dnd5e, migrated, 1, { attributeKey: "str", save: true }, () => 10).result.total).toBe(12);
  });
});

describe("automatic values on existing sheets", () => {
  it("new sheets follow the rules; older ones keep their values until turned on", () => {
    expect(createSheet(tormenta20).autoDerived).toBe(true);
    const old = { ...createSheet(tormenta20), autoDerived: undefined, resources: { ...createSheet(tormenta20).resources, pv: { current: 30, max: 40 } } };
    const loaded = ensureSheet({ sheet: old, resources: [] } as unknown as Character, tormenta20);
    expect(loaded.autoDerived).toBeUndefined();
    const system = t20WithClass();
    const withClass = { ...loaded, classKey: system.classes![0].key };
    expect(syncSheet(system, withClass, 5)).toBe(withClass);
    expect(syncSheet(system, { ...withClass, autoDerived: true }, 5).resources.pv.max).toBe(12 + 12);
  });
});
