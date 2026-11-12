/**
 * GURPS on the sheet: PV = ST and PF = HT (plus extra bought), Velocidade
 * Básica = (HT + DX) / 4, Deslocamento, Esquiva, Carga Básica, and the point
 * total: attributes (ST/HT 10, DX/IQ 20 per level; Vontade and Percepção 5 per
 * level over IQ; extra PV 2 and PF 3 each), traits and skills against the budget.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attr, moduleBuild } from "@/features/systems/rules/helpers";
import { autoDerived, setResourceMax } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";

export interface Trait {
  id: string;
  name: string;
  /** Points: positive for advantages, negative for disadvantages and quirks. */
  cost: number;
}
export interface GurpsBuild {
  budget: number;
  extraHp: number;
  extraFp: number;
  skillPoints: number;
  traits: Trait[];
}
export const gurpsBuild = moduleBuild<GurpsBuild>("gurps", () => ({ budget: 150, extraHp: 0, extraFp: 0, skillPoints: 0, traits: [] }));

const RATE: Record<string, number> = { st: 10, dx: 20, iq: 20, ht: 10 };

/** What an attribute value costs (Vontade and Percepção are bought over IQ). */
export function attributeCost(key: string, value: number, all: Record<string, number>): number {
  if (RATE[key]) return (value - 10) * RATE[key];
  if (key === "will" || key === "per") return (value - (all.iq ?? 10)) * 5;
  return 0;
}

export function pointsSpent(system: SystemTemplate, sheet: CharacterSheet): { attributes: number; traits: number; skills: number; extras: number; total: number } {
  const all = Object.fromEntries(system.attributes.map((a) => [a.key, attr(system, sheet, a.key)]));
  const b = gurpsBuild.read(sheet);
  const attributes = system.attributes.reduce((sum, a) => sum + attributeCost(a.key, all[a.key], all), 0);
  const traits = b.traits.reduce((sum, t) => sum + t.cost, 0);
  const extras = b.extraHp * 2 + b.extraFp * 3;
  return { attributes, traits, skills: b.skillPoints, extras, total: attributes + traits + b.skillPoints + extras };
}

export const basicSpeed = (system: SystemTemplate, sheet: CharacterSheet) => (attr(system, sheet, "ht") + attr(system, sheet, "dx")) / 4;

export const gurpsRules: SystemRules = {
  systemId: "gurps",
  derived(system, sheet) {
    const speed = basicSpeed(system, sheet);
    const st = attr(system, sheet, "st");
    const spent = pointsSpent(system, sheet);
    return [
      { key: "speed", label: "Velocidade", value: speed.toLocaleString("pt-BR", { maximumFractionDigits: 2 }), hint: "(HT + DX) / 4" },
      { key: "move", label: "Deslocamento", value: Math.floor(speed) },
      { key: "dodge", label: "Esquiva", value: Math.floor(speed) + 3 },
      { key: "lift", label: "Carga básica", value: `${Math.round((st * st) / 5)} lb`, hint: "ST × ST / 5" },
      { key: "points", label: "Pontos", value: `${spent.total}/${gurpsBuild.read(sheet).budget}`, hint: `Atributos ${spent.attributes}, PV/PF ${spent.extras}, traços ${spent.traits}, perícias ${spent.skills}` },
      { key: "left", label: "Sobrando", value: gurpsBuild.read(sheet).budget - spent.total },
    ];
  },
  sync(system, sheet) {
    if (!autoDerived(sheet)) return sheet;
    const b = gurpsBuild.read(sheet);
    const next = setResourceMax(sheet, "hp", Math.max(1, attr(system, sheet, "st") + b.extraHp));
    return setResourceMax(next, "fp", Math.max(1, attr(system, sheet, "ht") + b.extraFp));
  },
};
