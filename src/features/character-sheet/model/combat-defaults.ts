/**
 * Default combat block of a new sheet: a starting attack wired to the
 * system's melee attribute/skill. Kept apart from `sheet.ts` so the combat
 * profile (which reads sheets) does not create an import cycle.
 */
import { createId } from "@/lib/id";
import type { SheetAttack, SheetCombat } from "@/types/character";
import type { AttributeDefinition, SystemTemplate } from "@/types/system";

export const DEFAULT_SPEED = 6;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** First attribute whose key is in `keys` (templates name them differently: dex/des, str/for…). */
export function findAttribute(system: SystemTemplate, keys: string[]): AttributeDefinition | undefined {
  for (const key of keys) {
    const attr = system.attributes.find((a) => a.key === key);
    if (attr) return attr;
  }
  return undefined;
}

/** First skill whose label starts with one of `prefixes` ("Lutar (briga)" matches "lutar"). */
export function findSkill(system: SystemTemplate, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    const skill = system.skills.find((s) => normalize(s.label).startsWith(prefix));
    if (skill) return skill.key;
  }
  return null;
}

/** A new attack with the system's usual melee attribute, skill and damage shape. */
export function newAttack(system: SystemTemplate, name = "Novo ataque"): SheetAttack {
  const base = { id: createId("atk"), name, proficient: true, bonus: 0, range: 1 };
  const pick = (attrKeys: string[], skillPrefixes: string[], damage: string): SheetAttack => ({
    ...base,
    attributeKey: findAttribute(system, attrKeys)?.key ?? null,
    skillKey: skillPrefixes.length ? findSkill(system, skillPrefixes) : null,
    damage,
  });
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      return pick(["str", "for"], ["luta"], "1d8+@mod");
    case "d20-pool-keep-highest":
      return pick(["for"], ["luta"], "1d6");
    case "d100-roll-under":
      return pick([], ["lutar", "briga"], "1d3");
    case "d10-dice-pool":
      return pick(["strength"], ["briga"], "0");
    case "d6-plus-attribute":
      return pick(["poder"], ["luta"], "0");
    case "d10-plus-stat-skill":
      return pick(["dex"], ["briga"], "1d6");
    case "3d6-roll-under":
      return pick(["dx"], ["briga"], "1d6-1");
    case "custom":
    default:
      return pick([system.attributes[0]?.key ?? ""], [], "1d6");
  }
}

export function defaultCombat(system: SystemTemplate): SheetCombat {
  return { defense: null, armor: 0, speed: DEFAULT_SPEED, attacks: [newAttack(system, "Ataque corpo a corpo")] };
}
