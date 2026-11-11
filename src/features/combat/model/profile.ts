/**
 * Turns a character sheet into the combat block its token uses in the room:
 * defense (derived from attributes unless overridden), armor, speed,
 * initiative and the to-hit value of each attack under the system's mechanic.
 */
import { checkValue } from "@/features/character-sheet/model/checks";
import { findAttribute, findSkill } from "@/features/character-sheet/model/combat-defaults";
import { attributeModifier, proficiencyBonus } from "@/features/character-sheet/model/sheet";
import { armorClass, isDnd } from "@/features/systems/dnd5e/rules";
import type { CharacterSheet, SheetAttack } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import type { CombatStats, TokenAttack } from "./types";

function reader(system: SystemTemplate, sheet: CharacterSheet) {
  const value = (keys: string[]) => {
    const attr = findAttribute(system, keys);
    return attr ? (sheet.attributes[attr.key] ?? attr.defaultValue) : 0;
  };
  const mod = (keys: string[]) => {
    const attr = findAttribute(system, keys);
    return attr ? attributeModifier(attr, sheet.attributes[attr.key] ?? attr.defaultValue) : 0;
  };
  const skill = (prefixes: string[]) => {
    const key = findSkill(system, prefixes);
    return key ? (sheet.skills[key]?.bonus ?? 0) : null;
  };
  return { value, mod, skill };
}

/** Defense the sheet gets when the player leaves it on "automático". */
export function deriveDefense(system: SystemTemplate, sheet: CharacterSheet): number {
  const { value, mod, skill } = reader(system, sheet);
  // D&D 5e with an SRD build: worn armor, shield and unarmored defense.
  if (isDnd(system) && sheet.dnd) return armorClass(sheet).value;
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      return 10 + mod(["dex", "des"]);
    case "d20-pool-keep-highest":
      return 10 + value(["agi"]);
    case "d100-roll-under":
      return skill(["esquivar", "esquiva"]) ?? Math.floor(value(["dex"]) / 2);
    case "d10-dice-pool":
      return Math.max(1, value(["dexterity"]) + (skill(["atletismo"]) ?? 0));
    case "d6-plus-attribute":
      return value(["resistencia"]);
    case "d10-plus-stat-skill":
      return value(["dex"]) + (skill(["esquiva"]) ?? 0);
    case "3d6-roll-under":
      return Math.floor((value(["dx"]) + value(["ht"])) / 4) + 3;
    case "custom":
    default:
      return Math.ceil(Number(system.dice.primaryDie.slice(1)) / 2) + value([system.attributes[0]?.key ?? ""]);
  }
}

/** How the automatic defense is computed, for the sheet. */
export function defenseHint(system: SystemTemplate): string {
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      return "10 + modificador de Destreza";
    case "d20-pool-keep-highest":
      return "10 + Agilidade";
    case "d100-roll-under":
      return "valor de Esquivar (o alvo rola contra ele)";
    case "d10-dice-pool":
      return "parada de Destreza + Atletismo";
    case "d6-plus-attribute":
      return "Resistência, somada a 1d6 contra cada ataque";
    case "d10-plus-stat-skill":
      return "Destreza + Esquiva, somadas a 1d10 contra cada ataque";
    case "3d6-roll-under":
      return "Esquiva: (DX + HT) / 4 + 3, rolada em 3d6";
    case "custom":
    default:
      return `metade do ${system.dice.primaryDie} + ${system.attributes[0]?.label ?? "atributo"}`;
  }
}

/** Initiative modifier (or static score) and, for keep-highest pools, the number of d20s. */
export function deriveInitiative(system: SystemTemplate, sheet: CharacterSheet): { value: number; dice?: number } {
  const { value, mod } = reader(system, sheet);
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      // Pathfinder rolls Perception, which rides on Wisdom.
      return { value: (system.baseSystemId ?? system.id) === "pathfinder2e" ? mod(["wis"]) : mod(["dex", "des"]) };
    case "d20-pool-keep-highest":
      return { value: 0, dice: value(["agi"]) };
    case "d100-roll-under":
      return { value: value(["dex"]) };
    case "d10-dice-pool":
      return { value: value(["dexterity"]) + value(["wits"]) };
    case "d6-plus-attribute":
      return { value: value(["habilidade"]) };
    case "d10-plus-stat-skill":
      return { value: value(["ref"]) };
    case "3d6-roll-under":
      return { value: (value(["dx"]) + value(["ht"])) / 4 };
    case "custom":
    default:
      return { value: value([system.attributes[0]?.key ?? ""]) };
  }
}

/** Replaces `@mod` / `@value` with the attack attribute and tidies the signs ("1d8+-1" → "1d8-1"). */
export function resolveDamageFormula(system: SystemTemplate, sheet: CharacterSheet, attack: Pick<SheetAttack, "attributeKey" | "damage">): string {
  const attr = attack.attributeKey ? system.attributes.find((a) => a.key === attack.attributeKey) : undefined;
  const value = attr ? (sheet.attributes[attr.key] ?? attr.defaultValue) : 0;
  const mod = attr ? attributeModifier(attr, value) : 0;
  return attack.damage
    .replace(/@mod/gi, String(mod))
    .replace(/@value/gi, String(value))
    .replace(/\s+/g, "")
    .replace(/\+-|-\+/g, "-")
    .replace(/--/g, "+")
    .replace(/\+\+/g, "+")
    .replace(/([d\d])[+-]0(?!\d)/g, "$1");
}

export function attackStats(system: SystemTemplate, sheet: CharacterSheet, level: number | null, attack: SheetAttack): TokenAttack {
  const { value, dice } = checkValue(system, sheet, level, { attributeKey: attack.attributeKey ?? undefined, skillKey: attack.skillKey ?? undefined });
  // d20 systems without weapon skills add proficiency when the character is trained with the weapon.
  const proficiency = system.dice.mechanic === "d20-plus-modifier" && !attack.skillKey && attack.proficient ? proficiencyBonus(system, level) : 0;
  return {
    id: attack.id,
    name: attack.name.trim() || "Ataque",
    value: value + proficiency + attack.bonus,
    dice,
    damage: resolveDamageFormula(system, sheet, attack) || "1",
    range: Math.max(1, Math.round(attack.range)),
  };
}

export function combatProfile(system: SystemTemplate, sheet: CharacterSheet, level: number | null): CombatStats {
  const initiative = deriveInitiative(system, sheet);
  return {
    defense: sheet.combat.defense ?? deriveDefense(system, sheet),
    armor: Math.max(0, sheet.combat.armor),
    speed: Math.max(1, sheet.combat.speed),
    initiative: initiative.value,
    initiativeDice: initiative.dice,
    attacks: sheet.combat.attacks.map((a) => attackStats(system, sheet, level, a)),
  };
}

/** Hit points shown on the token: the template's first resource (health in every system). */
export function sheetHitPoints(system: SystemTemplate, sheet: CharacterSheet): { current: number; max: number } | null {
  const key = system.resources[0]?.key;
  const hp = key ? sheet.resources[key] : undefined;
  return hp ? { current: hp.current, max: Math.max(1, hp.max) } : null;
}
