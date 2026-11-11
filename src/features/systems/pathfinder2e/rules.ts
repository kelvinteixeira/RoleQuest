/**
 * Pathfinder 2e on the sheet: proficiency ranks (untrained 0; trained,
 * expert, master, legendary = level + 2/4/6/8) for skills, saves, Perception,
 * armor class and class DC; AC = 10 + DEX (up to the armor's cap) + rank +
 * item; HP = ancestry + (class + CON) × level; Perception is initiative.
 * Ancestries, classes and feats are typed in by the group.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attr, lvl, moduleBuild, signed } from "@/features/systems/rules/helpers";
import { setResourceMax, autoDerived } from "@/features/systems/rules/build";
import type { SaveDefinition, SystemRules } from "@/features/systems/rules/types";

export const RANKS = ["Destreinado", "Treinado", "Especialista", "Mestre", "Lendário"] as const;

export interface Pf2Build {
  ancestryHp: number;
  classHp: number;
  keyAttribute: string;
  itemAc: number;
  /** DEX cap of the worn armor; 99 = none. */
  dexCap: number;
  /** Feet. */
  speed: number;
  /** perception, fort, ref, will, ac, classdc and skill keys → 0..4. */
  ranks: Record<string, number>;
}
export const pf2Build = moduleBuild<Pf2Build>("pathfinder2e", () => ({ ancestryHp: 0, classHp: 0, keyAttribute: "str", itemAc: 0, dexCap: 99, speed: 25, ranks: {} }));

/** Proficiency of a rank at a level (untrained adds nothing). */
export const proficiency = (rank: number, level: number | null) => (rank > 0 ? 2 * rank + lvl(level) : 0);

/** A skill's rank: the stored one, else trained/untrained from the sheet. */
export function skillRank(sheet: CharacterSheet, key: string): number {
  const stored = pf2Build.read(sheet).ranks[key];
  return stored ?? (sheet.skills[key]?.trained ? 1 : 0);
}

const SAVES = [
  { key: "fort", label: "Fortitude", attr: "con" },
  { key: "ref", label: "Reflexos", attr: "dex" },
  { key: "will", label: "Vontade", attr: "wis" },
  { key: "perception", label: "Percepção", attr: "wis" },
] as const;

const rankOf = (sheet: CharacterSheet, key: string, fallback = 1) => pf2Build.read(sheet).ranks[key] ?? fallback;

export function pf2Ac(system: SystemTemplate, sheet: CharacterSheet, level: number | null): number {
  const b = pf2Build.read(sheet);
  return 10 + Math.min(attr(system, sheet, "dex"), b.dexCap) + proficiency(rankOf(sheet, "ac"), level) + b.itemAc;
}

export function pf2Save(system: SystemTemplate, sheet: CharacterSheet, level: number | null, key: (typeof SAVES)[number]["key"]): number {
  const save = SAVES.find((s) => s.key === key)!;
  return attr(system, sheet, save.attr) + proficiency(rankOf(sheet, key), level);
}

export function pf2HpMax(system: SystemTemplate, sheet: CharacterSheet, level: number | null): number | null {
  const b = pf2Build.read(sheet);
  if (!b.classHp) return null;
  return Math.max(1, b.ancestryHp + (b.classHp + attr(system, sheet, "con")) * lvl(level));
}

export const pf2Rules: SystemRules = {
  systemId: "pathfinder2e",
  derived(system, sheet, level) {
    const b = pf2Build.read(sheet);
    return [
      { key: "ac", label: "CA", value: pf2Ac(system, sheet, level), hint: `10 + DES${b.dexCap < 99 ? ` (máx. ${b.dexCap})` : ""} + ${RANKS[rankOf(sheet, "ac")]} + item` },
      { key: "perception", label: "Percepção", value: signed(pf2Save(system, sheet, level, "perception")), hint: "Também é a iniciativa" },
      { key: "classdc", label: "CD de classe", value: 10 + attr(system, sheet, b.keyAttribute) + proficiency(rankOf(sheet, "classdc"), level) },
      { key: "hp", label: "PV máx.", value: pf2HpMax(system, sheet, level) ?? "—", hint: "Ancestralidade + (classe + CON) × nível" },
      { key: "speed", label: "Desloc.", value: `${b.speed} ft` },
      { key: "level", label: "Nível", value: lvl(level) },
    ];
  },
  sync(system, sheet, level) {
    if (!autoDerived(sheet)) return sheet;
    let next = sheet;
    const hp = pf2HpMax(system, sheet, level);
    if (hp !== null) next = setResourceMax(next, "hp", hp);
    const squares = Math.max(1, Math.round(pf2Build.read(sheet).speed / 5));
    return next.combat.speed === squares ? next : { ...next, combat: { ...next.combat, speed: squares } };
  },
  defense: (system, sheet, level) => pf2Ac(system, sheet, level),
  initiative: (system, sheet, level) => ({ value: pf2Save(system, sheet, level, "perception") }),
  saves: (system, sheet, level): SaveDefinition[] =>
    SAVES.map((s) => ({
      key: s.key,
      label: `${s.label} · ${RANKS[rankOf(sheet, s.key)]}`,
      request: { attributeKey: s.attr, save: true, saveKey: s.key, label: s.label },
      proficient: rankOf(sheet, s.key) > 0,
      value: pf2Save(system, sheet, level, s.key),
    })),
  // The sheet's "trained" already adds level + 2; higher ranks add 2 more each.
  checkBonus(_system, sheet, _level, req) {
    if (req.skillKey) return Math.max(0, skillRank(sheet, req.skillKey) - 1) * 2;
    if (req.save && req.saveKey) return Math.max(0, rankOf(sheet, req.saveKey) - 1) * 2;
    return 0;
  },
};
