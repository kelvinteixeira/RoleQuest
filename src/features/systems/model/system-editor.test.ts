import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_SYSTEMS, getBuiltInSystem } from "@/features/systems/templates";
import { createCustomSystem } from "@/features/systems/templates/custom";
import { applyClass, createSheet } from "@/features/character-sheet/model/sheet";
import { resetMockDatabase } from "@/repositories/mock";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { systemService } from "@/services/system.service";
import type { SystemTemplate } from "@/types/system";
import { proficiencyBonus } from "@/features/character-sheet/model/sheet";
import { rulesFor } from "@/features/combat/model/rules";
import { duplicateAsCustom, keyFromLabel, newClass, newKey, pruneReferences, validateSystem } from "./system-editor";

const base = (): SystemTemplate => ({
  ...createCustomSystem({ name: "Brasas", theme: "", primaryDie: "d20" }),
  skills: [{ key: "furtividade", label: "Furtividade", attributeKey: "body" }],
  classes: [{ ...newClass("Guardião", []), skillKeys: ["furtividade"], resourceBonus: { hp: 4 }, abilities: ["Escudo de brasa"] }],
});

describe("system editor model", () => {
  it("makes unique keys from labels", () => {
    expect(keyFromLabel("Força Bruta", [])).toBe("forca-bruta");
    expect(keyFromLabel("Força Bruta", ["forca-bruta", "forca-bruta-2"])).toBe("forca-bruta-3");
    expect(keyFromLabel("!!!", [])).toBe("campo");
  });

  it("accepts a fresh custom system and every built-in duplicated as custom", () => {
    expect(validateSystem(base())).toEqual({});
    for (const s of BUILT_IN_SYSTEMS) expect(validateSystem(duplicateAsCustom(s)), s.id).toEqual({});
  });

  it("reports broken parts by path", () => {
    const s = base();
    const broken: SystemTemplate = {
      ...s,
      name: " ",
      attributes: [{ ...s.attributes[0], min: 5, max: 1 }],
      customFields: [{ key: "x", label: "Caminho", type: "select", section: "Extra", options: ["só uma"] }],
      progression: { ...s.progression, levels: [{ level: 2, threshold: 100, perks: "" }, { level: 1, threshold: 50, perks: "" }] },
    };
    const errors = validateSystem(broken);
    expect(Object.keys(errors).sort()).toEqual(["attributes.0.range", "customFields.0.options", "name", "progression.levels.1.level"]);
  });

  it("drops references to removed attributes, skills and resources", () => {
    const s = base();
    const pruned = pruneReferences({ ...s, attributes: s.attributes.filter((a) => a.key !== "body"), skills: s.skills, resources: s.resources.filter((r) => r.key !== "hp") });
    expect(pruned.skills[0].attributeKey).toBeUndefined();
    expect(pruned.classes![0].resourceBonus).toEqual({});
    expect(validateSystem(pruneReferences({ ...s, skills: [] })).classes).toBeUndefined();
    expect(pruneReferences({ ...s, skills: [] }).classes![0].skillKeys).toEqual([]);
  });

  it("duplicates a built-in as an independent custom system", () => {
    const dnd = getBuiltInSystem("dnd5e")!;
    const copy = duplicateAsCustom(dnd);
    expect(copy).toMatchObject({ kind: "custom", baseSystemId: "dnd5e", name: `${dnd.name} (variação)`.slice(0, 40), licensing: { basis: dnd.licensing.basis } });
    expect(copy.licensing.note).toContain(dnd.licensing.note);
    expect(copy.id).not.toBe(dnd.id);
    copy.attributes[0].label = "Mudado";
    expect(dnd.attributes[0].label).not.toBe("Mudado");
  });

  it("copies keep their base system's rules", () => {
    const pf2 = duplicateAsCustom(getBuiltInSystem("pathfinder2e")!);
    expect(proficiencyBonus(pf2, 3)).toBe(proficiencyBonus(getBuiltInSystem("pathfinder2e")!, 3));
    expect(rulesFor(pf2)).toMatchObject({ systemId: pf2.id, family: "pathfinder2e" });
    // A copy of a copy still remembers the base.
    expect(duplicateAsCustom(pf2).baseSystemId).toBe("pathfinder2e");
    // Other custom d20 systems: trained still means something.
    expect(proficiencyBonus({ ...base(), dice: { ...base().dice, mechanic: "d20-plus-modifier" } }, 1)).toBe(2);
  });

  it("new keys never reuse a removed one", () => {
    const a = newKey("Recurso", []);
    const b = newKey("Recurso", []);
    expect(a).not.toBe(b);
    expect(a.startsWith("recurso-")).toBe(true);
  });

  it("points are only checked when the progression uses them; levels stay under the max", () => {
    const s = base();
    const levels = [{ level: 1, threshold: 500, perks: "" }, { level: 2, threshold: 100, perks: "" }];
    expect(validateSystem({ ...s, progression: { ...s.progression, model: "levels", levels } })).toEqual({});
    expect(Object.keys(validateSystem({ ...s, progression: { ...s.progression, model: "experience-points", levels } }))).toEqual(["progression.levels.1.threshold"]);
    expect(Object.keys(validateSystem({ ...s, progression: { ...s.progression, max: 1, levels: [{ level: 2, perks: "" }] } }))).toEqual(["progression.levels.0.level"]);
  });
});

describe("classes on the sheet", () => {
  it("apply bonuses, trained skills and abilities; switching class moves only the bonus", () => {
    const s = base();
    const withMage: SystemTemplate = { ...s, classes: [...s.classes!, { ...newClass("Mago", ["guardiao"]), resourceBonus: { energy: 3 }, abilities: ["Faísca"] }] };
    let sheet = createSheet(withMage);
    sheet = applyClass(withMage, sheet, s.classes![0].key);
    expect(sheet.resources.hp).toEqual({ current: 14, max: 14 });
    expect(sheet.skills.furtividade.trained).toBe(true);
    expect(sheet.abilities.map((a) => [a.name, a.kind])).toEqual([["Escudo de brasa", "Guardião"]]);

    const mage = withMage.classes![1].key;
    sheet = applyClass(withMage, applyClass(withMage, sheet, mage), mage);
    expect(sheet.classKey).toBe(mage);
    expect(sheet.resources.hp).toEqual({ current: 10, max: 10 });
    expect(sheet.resources.energy.max).toBe(8);
    expect(sheet.abilities.map((a) => a.name)).toEqual(["Escudo de brasa", "Faísca"]);
    expect(applyClass(withMage, sheet, null).classKey).toBeUndefined();
  });

  it("undo the bonus that was applied even if the GM changed or deleted the class", () => {
    const s = base();
    const guard = s.classes![0].key;
    let sheet = applyClass(s, createSheet(s), guard);
    expect(sheet.resources.hp.max).toBe(14);
    // GM raises the bonus to +6, then the player drops the class: back to 10, not 8.
    const changed: SystemTemplate = { ...s, classes: [{ ...s.classes![0], resourceBonus: { hp: 6 } }] };
    expect(applyClass(changed, sheet, null).resources.hp.max).toBe(10);
    // GM deletes the class: the +4 still comes off.
    expect(applyClass({ ...s, classes: [] }, sheet, null).resources.hp.max).toBe(10);
    // Losing a bonus caps current instead of dealing damage.
    sheet = { ...sheet, resources: { ...sheet.resources, hp: { current: 3, max: 14 } } };
    expect(applyClass(s, sheet, null).resources.hp).toEqual({ current: 3, max: 10 });
  });
});

describe("system service", () => {
  beforeEach(() => resetMockDatabase());

  it("creates, edits and duplicates systems for their owner only", async () => {
    const mine = await systemService.createCustom(DEMO_USER_ID, "Brasas");
    const edited = await systemService.saveCustom(DEMO_USER_ID, { ...mine, attributes: [...mine.attributes, { key: "sorte", label: "Sorte", abbreviation: "SOR", min: 0, max: 5, defaultValue: 1 }] });
    expect(edited.attributes.map((a) => a.key)).toContain("sorte");
    expect((await systemService.getEditable(mine.id, DEMO_USER_ID)).attributes).toHaveLength(4);

    await expect(systemService.getEditable(mine.id, "user_camila")).rejects.toMatchObject({ code: "forbidden" });
    await expect(systemService.saveCustom("user_camila", edited)).rejects.toMatchObject({ code: "forbidden" });
    await expect(systemService.getEditable("dnd5e", DEMO_USER_ID)).rejects.toMatchObject({ code: "forbidden" });
    await expect(systemService.saveCustom(DEMO_USER_ID, { ...edited, attributes: [] })).rejects.toMatchObject({ code: "validation" });

    const copy = await systemService.duplicate(DEMO_USER_ID, "call-of-cthulhu");
    expect(copy.kind).toBe("custom");
    expect((await systemService.listForUser(DEMO_USER_ID)).some((s) => s.id === copy.id)).toBe(true);
  });
});
