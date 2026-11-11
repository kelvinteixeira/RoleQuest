/**
 * Pure sheet helpers: defaults from a system template, merging older
 * records, derived values (modifiers, proficiency, carried weight) and the
 * resource summary shown on cards and tokens.
 */
import { createId } from "@/lib/id";
import type { Character, CharacterResourceValue, CharacterSheet, SheetItem } from "@/types/character";
import type { AttributeDefinition, SystemTemplate } from "@/types/system";
import { defaultCombat } from "./combat-defaults";

const EMPTY_STORY: CharacterSheet["story"] = { background: "", personality: "", appearance: "", relationships: "", history: "" };

/** Scores like 1–30 (D&D) derive a modifier; templates whose values already are modifiers return them as is. */
export function usesScoreModifier(attr: AttributeDefinition): boolean {
  return attr.max >= 20 && attr.defaultValue === 10;
}

export function attributeModifier(attr: AttributeDefinition, value: number): number {
  return usesScoreModifier(attr) ? Math.floor((value - 10) / 2) : value;
}

/**
 * Proficiency/training bonus by level, per system family (custom copies keep
 * their base's curve). Other custom d20 systems use a gentle default curve, so
 * "trained" means something there too.
 */
export function proficiencyBonus(system: SystemTemplate, level: number | null): number {
  const lvl = Math.max(1, level ?? 1);
  switch (system.baseSystemId ?? system.id) {
    case "dnd5e":
      return 2 + Math.floor((lvl - 1) / 4);
    case "pathfinder2e":
      return 2 + lvl;
    case "tormenta20":
      return 2 + Math.floor(lvl / 2);
    default:
      return system.kind === "custom" && system.dice.mechanic === "d20-plus-modifier" ? 2 + Math.floor((lvl - 1) / 4) : 0;
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
  return { attributes, resources, skills, abilities: [], inventory: [], currency, custom, combat: defaultCombat(system), conditions: [], story: { ...EMPTY_STORY }, privateNotes: "" };
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
  // Sheets from before rules modules kept D&D choices in `dnd`: they move to `build`.
  const { dnd: legacy, ...current } = sheet;
  const migrated: Partial<CharacterSheet> = legacy && !sheet.build
    ? { build: { system: "dnd5e", data: { race: legacy.race, class: legacy.class, background: legacy.background, armor: legacy.armor, shield: legacy.shield, raceBonus: legacy.raceBonus } }, autoDerived: sheet.autoDerived ?? legacy.auto }
    : {};
  return {
    ...defaults,
    ...current,
    ...migrated,
    attributes: { ...defaults.attributes, ...sheet.attributes },
    resources: { ...defaults.resources, ...sheet.resources },
    skills: { ...defaults.skills, ...sheet.skills },
    currency: { ...defaults.currency, ...sheet.currency },
    custom: { ...defaults.custom, ...sheet.custom },
    // Sheets saved before the combat tab get the default attack.
    combat: sheet.combat ? { ...defaults.combat, ...sheet.combat } : defaults.combat,
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

/**
 * Picks (or clears) a custom-system class: resource maximums move by the
 * difference between the old and new class bonuses (current values follow),
 * the class's skills become trained and its abilities are added once.
 * Nothing the player wrote is removed.
 */
export function applyClass(system: SystemTemplate, sheet: CharacterSheet, classKey: string | null): CharacterSheet {
  const classes = system.classes ?? [];
  const after = classKey ? classes.find((c) => c.key === classKey) : undefined;
  if (classKey && !after) return sheet;
  // Undo what was really applied (the GM may have changed or deleted the class since).
  const applied = sheet.classBonus ?? classes.find((c) => c.key === sheet.classKey)?.resourceBonus ?? {};
  const granted = after?.resourceBonus ?? {};

  const resources = { ...sheet.resources };
  for (const key of new Set([...Object.keys(applied), ...Object.keys(granted)])) {
    const delta = (granted[key] ?? 0) - (applied[key] ?? 0);
    const value = resources[key];
    if (!delta || !value) continue;
    const max = Math.max(0, value.max + delta);
    // A bonus raises current too; losing one only caps it (switching class doesn't deal damage).
    resources[key] = { max, current: delta > 0 ? value.current + delta : Math.min(value.current, max) };
  }
  const skills = { ...sheet.skills };
  for (const key of after?.skillKeys ?? []) skills[key] = { ...(skills[key] ?? { bonus: 0 }), trained: true };
  const known = new Set(sheet.abilities.map((a) => a.name.trim().toLocaleLowerCase("pt-BR")));
  const abilities = [
    ...sheet.abilities,
    ...(after?.abilities ?? []).filter((name) => !known.has(name.trim().toLocaleLowerCase("pt-BR"))).map((name) => ({ ...newAbility(name), kind: after!.label })),
  ];
  return { ...sheet, classKey: after?.key, classBonus: after ? { ...granted } : undefined, resources, skills, abilities };
}

/** Perks of a level in the system's table, if any. */
export function levelPerks(system: SystemTemplate, level: number | null): string | null {
  return system.progression.levels?.find((l) => l.level === level)?.perks || null;
}
