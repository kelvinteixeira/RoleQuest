/**
 * Tormenta20 rules on the sheet: Defesa, half the level on every skill plus
 * the training bonus (2/4/6), Fortitude/Reflexos/Vontade as the saves, and PV
 * and PM that grow with the class the group registered (generic class growth).
 * Races, origins, classes and powers are the group's to register.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { proficiencyBonus } from "@/features/character-sheet/model/sheet";
import { classOf, growthHint } from "@/features/systems/rules/generic";
import { attr, lvl, moduleBuild, signed } from "@/features/systems/rules/helpers";
import type { SystemRules } from "@/features/systems/rules/types";

export interface T20Build {
  /** Armor, shield and other bonuses on Defesa. */
  defenseBonus: number;
}
export const t20Build = moduleBuild<T20Build>("tormenta20", () => ({ defenseBonus: 0 }));

export const halfLevel = (level: number | null) => Math.floor(lvl(level) / 2);

export function t20Defense(system: SystemTemplate, sheet: CharacterSheet): number {
  return 10 + attr(system, sheet, "des") + t20Build.read(sheet).defenseBonus;
}

/** A skill's total: attribute + half level + training (when trained) + its own bonus. */
export function t20Skill(system: SystemTemplate, sheet: CharacterSheet, level: number | null, key: string): number {
  const def = system.skills.find((s) => s.key === key);
  const skill = sheet.skills[key] ?? { trained: false, bonus: 0 };
  const attrKey = skill.attribute ?? def?.attributeKey;
  return (attrKey ? attr(system, sheet, attrKey) : 0) + halfLevel(level) + (skill.trained ? proficiencyBonus(system, level) : 0) + skill.bonus;
}

const SAVES = [
  { key: "fortitude", label: "Fortitude" },
  { key: "reflexos", label: "Reflexos" },
  { key: "vontade", label: "Vontade" },
];

export const t20Rules: SystemRules = {
  systemId: "tormenta20",
  derived(system, sheet, level) {
    const cls = classOf(system, sheet);
    return [
      { key: "defense", label: "Defesa", value: t20Defense(system, sheet), hint: "10 + DES + armadura/escudo" },
      { key: "half", label: "½ nível", value: signed(halfLevel(level)), hint: "Somado a todas as perícias" },
      { key: "training", label: "Treino", value: signed(proficiencyBonus(system, level)), hint: "+2 até o 6º nível, +4 até o 14º, +6 depois" },
      { key: "pv", label: "PV máx.", value: sheet.resources.pv?.max ?? "—", hint: cls ? (growthHint(system, cls, "pv") ?? undefined) : "Escolha a classe" },
      { key: "pm", label: "PM máx.", value: sheet.resources.pm?.max ?? "—", hint: cls ? (growthHint(system, cls, "pm") ?? undefined) : "Escolha a classe" },
      { key: "class", label: system.classesLabel || "Classe", value: cls?.label ?? "—" },
    ];
  },
  sync: (_system, sheet) => sheet,
  defense: (system, sheet) => t20Defense(system, sheet),
  saves: (system, sheet, level) =>
    SAVES.filter((s) => system.skills.some((k) => k.key === s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      request: { skillKey: s.key },
      proficient: !!sheet.skills[s.key]?.trained,
      value: t20Skill(system, sheet, level, s.key),
    })),
  checkBonus: (_system, _sheet, level, req) => (req.skillKey ? halfLevel(level) : 0),
};
