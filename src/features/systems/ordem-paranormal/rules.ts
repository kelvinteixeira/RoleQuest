/**
 * Ordem Paranormal on the sheet: NEX as the level (5% to 99%), its exposure
 * level for class growth (PV, PE and SAN per NEX, from the class the group
 * registered), PE per turn, Defesa, and Fortitude/Reflexos/Vontade as saves.
 * Classes, origins, tracks and rituals are the group's to register.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { classOf, growthHint } from "@/features/systems/rules/generic";
import { attr, moduleBuild } from "@/features/systems/rules/helpers";
import type { SystemRules } from "@/features/systems/rules/types";

export interface OrdemBuild {
  defenseBonus: number;
}
export const ordemBuild = moduleBuild<OrdemBuild>("ordem-paranormal", () => ({ defenseBonus: 0 }));

/** Exposure level: one per 5% of NEX (99% is the 20th). */
export function nexLevel(nex: number | null): number {
  const n = nex ?? 5;
  return n >= 99 ? 20 : Math.max(1, Math.floor(n / 5));
}

export function ordemDefense(system: SystemTemplate, sheet: CharacterSheet): number {
  return 10 + attr(system, sheet, "agi") + ordemBuild.read(sheet).defenseBonus;
}

const SAVES = [
  { key: "fortitude", label: "Fortitude" },
  { key: "reflexos", label: "Reflexos" },
  { key: "vontade", label: "Vontade" },
];

export const ordemRules: SystemRules = {
  systemId: "ordem-paranormal",
  classLevel: nexLevel,
  derived(system, sheet, level) {
    const cls = classOf(system, sheet);
    const hint = (key: string) => (cls ? (growthHint(system, cls, key)?.replace(/nível/g, "NEX") ?? undefined) : "Escolha a classe");
    return [
      { key: "nex", label: "NEX", value: `${level ?? 5}%` },
      { key: "pe-turn", label: "PE por turno", value: nexLevel(level), hint: "Limite de PE gastos por turno: 1 a cada 5% de NEX" },
      { key: "defense", label: "Defesa", value: ordemDefense(system, sheet), hint: "10 + AGI + proteção" },
      { key: "pv", label: "PV máx.", value: sheet.resources.pv?.max ?? "—", hint: hint("pv") },
      { key: "pe", label: "PE máx.", value: sheet.resources.pe?.max ?? "—", hint: hint("pe") },
      { key: "san", label: "SAN máx.", value: sheet.resources.san?.max ?? "—", hint: hint("san") },
    ];
  },
  sync: (_system, sheet) => sheet,
  defense: (system, sheet) => ordemDefense(system, sheet),
  saves: (system, sheet) =>
    SAVES.filter((s) => system.skills.some((k) => k.key === s.key)).map((s) => {
      const def = system.skills.find((k) => k.key === s.key)!;
      return {
        key: s.key,
        label: `${s.label} (${def.attributeKey ? system.attributes.find((a) => a.key === def.attributeKey)?.abbreviation : "—"})`,
        request: { skillKey: s.key },
        proficient: !!sheet.skills[s.key]?.trained,
        value: sheet.skills[s.key]?.bonus ?? 0,
      };
    }),
};

