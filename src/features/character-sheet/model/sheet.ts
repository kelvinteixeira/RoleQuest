/**
 * Pure sheet helpers: defaults from a system template, merging older
 * records, derived values (modifiers, proficiency, carried weight) and the
 * resource summary shown on cards and tokens.
 */
import { createId } from "@/lib/id";
import type { Character, CharacterResourceValue, CharacterSheet, SheetItem } from "@/types/character";
import type { AttributeDefinition, SystemTemplate } from "@/types/system";

const EMPTY_STORY: CharacterSheet["story"] = { background: "", personality: "", appearance: "", relationships: "", history: "" };

/** Scores like 1–30 (D&D) derive a modifier; templates whose values already are modifiers return them as is. */
export function usesScoreModifier(attr: AttributeDefinition): boolean {
  return attr.max >= 20 && attr.defaultValue === 10;
}

export function attributeModifier(attr: AttributeDefinition, value: number): number {
  return usesScoreModifier(attr) ? Math.floor((value - 10) / 2) : value;
}

/** Proficiency/training bonus by level, per system family. */
export function proficiencyBonus(system: SystemTemplate, level: number | null): number {
  const lvl = Math.max(1, level ?? 1);
  switch (system.id) {
    case "dnd5e":
      return 2 + Math.floor((lvl - 1) / 4);
    case "pathfinder2e":
      return 2 + lvl;
    case "tormenta20":
      return 2 + Math.floor(lvl / 2);
    default:
      return 0;
  }
}

export function createSheet(system: SystemTemplate): CharacterSheet {
  const attributes = Object.fromEntries(system.attributes.map((a) => [a.key, a.defaultValue]));
  const resources = Object.fromEntries(system.resources.map((r) => [r.key, { current: r.defaultMax, max: r.defaultMax }]));
  // Starting skill value: a percentage in d100 systems, a 3d6 target in GURPS-like ones, a bonus elsewhere.
  const startingSkill = system.dice.mechanic === "d100-roll-under" ? 20 : system.dice.mechanic === "3d6-roll-under" ? 10 : 0;
  const skills = Object.fromEntries(system.skills.map((s) => [s.key, { trained: false, bonus: startingSkill }]));
  const custom = Object.fromEntries(
    system.customFields.map((f) => [f.key, f.type === "number" || f.type === "counter" ? 0 : f.type === "checkbox" ? false : f.type === "list" ? [] : ""]),
  );
  const currency = Object.fromEntries(system.inventory.currencies.map((c) => [c, 0]));
  // Call of Cthulhu style: sanity starts at POW.
  if (resources.san && attributes.pow !== undefined && system.dice.mechanic === "d100-roll-under") resources.san = { current: attributes.pow, max: attributes.pow };
  return { attributes, resources, skills, abilities: [], inventory: [], currency, custom, conditions: [], story: { ...EMPTY_STORY }, privateNotes: "" };
}

/** Fills keys missing from older sheets (or added to the template later) without touching existing values. */
export function ensureSheet(character: Character, system: SystemTemplate): CharacterSheet {
  const defaults = createSheet(system);
  const sheet = character.sheet;
  if (!sheet) {
    // Seed from the summary values the record already had.
    for (const r of character.resources) if (defaults.resources[r.key]) defaults.resources[r.key] = { current: r.current, max: r.max };
    return defaults;
  }
  return {
    ...defaults,
    ...sheet,
    attributes: { ...defaults.attributes, ...sheet.attributes },
    resources: { ...defaults.resources, ...sheet.resources },
    skills: { ...defaults.skills, ...sheet.skills },
    currency: { ...defaults.currency, ...sheet.currency },
    custom: { ...defaults.custom, ...sheet.custom },
    story: { ...EMPTY_STORY, ...sheet.story },
  };
}

/** Card/token summary: the template's resources in order, with current values. */
export function summarizeResources(system: SystemTemplate, sheet: CharacterSheet): CharacterResourceValue[] {
  return system.resources
    .filter((r) => sheet.resources[r.key])
    .slice(0, 3)
    .map((r) => ({ key: r.key, label: r.label, color: r.color, current: sheet.resources[r.key].current, max: sheet.resources[r.key].max }));
}

export function carriedWeight(items: SheetItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.weight * i.quantity, 0) * 10) / 10;
}

export function newItem(name = "Novo item"): SheetItem {
  return { id: createId("item"), name, quantity: 1, weight: 0, equipped: false, slot: null, notes: "" };
}

export function newAbility(name = "Nova habilidade"): CharacterSheet["abilities"][number] {
  return { id: createId("ab"), name, kind: "", cost: "", description: "" };
}
