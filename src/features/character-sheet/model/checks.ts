/**
 * Resolves attribute and skill checks with each system's own dice rules.
 * Returns a RollResult (same shape the chat already renders) plus a short
 * outcome text such as "Sucesso difícil" or "3 sucessos".
 */
import { cryptoRng, roll, type RollMode, type RollResult, type Rng } from "@/features/dice/dice-engine";
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attributeModifier, proficiencyBonus } from "./sheet";

export interface CheckRequest {
  attributeKey?: string;
  skillKey?: string;
  mode?: RollMode;
}

export interface CheckResult {
  /** "Furtividade (DES)" */
  label: string;
  outcome: string | null;
  tone: "success" | "failure" | "critical" | "fumble" | "neutral";
  result: RollResult;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Pools never exceed this many dice (a sheet with absurd values can't stall whoever rolls). */
const MAX_POOL = 60;

function dice(count: number, sides: number, rng: Rng) {
  return Array.from({ length: Math.max(0, Math.min(MAX_POOL, Math.floor(count) || 0)) }, () => rng(sides));
}

function checkInputs(system: SystemTemplate, sheet: CharacterSheet, req: Pick<CheckRequest, "attributeKey" | "skillKey">) {
  const skillDef = req.skillKey ? system.skills.find((s) => s.key === req.skillKey) : undefined;
  const sheetSkill = req.skillKey ? sheet.skills[req.skillKey] : undefined;
  // Percentile/roll-under skills are their own target; other mechanics add an attribute.
  const attrKey =
    req.attributeKey ??
    (skillDef ? (skillUsesAttribute(system) ? (sheetSkill?.attribute ?? skillDef.attributeKey ?? system.attributes[0]?.key) : undefined) : system.attributes[0]?.key);
  const attrDef = system.attributes.find((a) => a.key === attrKey);
  const attrValue = attrDef ? (sheet.attributes[attrDef.key] ?? attrDef.defaultValue) : 0;
  const skill = req.skillKey ? (sheet.skills[req.skillKey] ?? { trained: false, bonus: 0 }) : null;
  const label = skillDef ? `${skillDef.label}${attrDef ? ` (${attrDef.abbreviation})` : ""}` : (attrDef?.label ?? "Teste");
  return { attrDef, attrValue, skill, label };
}

/**
 * The number a check adds to (or rolls under) with this system's mechanic:
 * modifier + proficiency, skill %, pool size, target… `dice` is the d20 count of keep-highest pools.
 * Attacks reuse it, so a weapon skill counts the same as on a check.
 */
export function checkValue(system: SystemTemplate, sheet: CharacterSheet, level: number | null, req: Pick<CheckRequest, "attributeKey" | "skillKey">): { value: number; dice?: number } {
  const { attrDef, attrValue, skill } = checkInputs(system, sheet, req);
  const bonus = skill?.bonus ?? 0;
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      return { value: (attrDef ? attributeModifier(attrDef, attrValue) : 0) + (skill?.trained ? proficiencyBonus(system, level) : 0) + bonus };
    case "d100-roll-under":
      return { value: skill ? skill.bonus : attrValue };
    case "d10-dice-pool":
      return { value: Math.max(1, attrValue + bonus) };
    case "d20-pool-keep-highest":
      return { value: bonus, dice: attrValue };
    case "d6-plus-attribute":
      return { value: attrValue + (skill?.trained ? 2 : 0) + bonus };
    case "d10-plus-stat-skill":
      return { value: attrValue + bonus };
    case "3d6-roll-under":
      return { value: skill ? skill.bonus || attrValue : attrValue };
    case "custom":
    default:
      return { value: attrValue + bonus + (skill?.trained ? 2 : 0) };
  }
}

export function resolveCheck(system: SystemTemplate, sheet: CharacterSheet, level: number | null, req: CheckRequest, rng: Rng = cryptoRng): CheckResult {
  const { label } = checkInputs(system, sheet, req);
  const { value, dice: poolDice = 0 } = checkValue(system, sheet, level, req);

  switch (system.dice.mechanic) {
    case "d20-plus-modifier": {
      const result = roll(`1d20${signed(value)}`, req.mode ?? "normal", rng);
      const nat = result.natural;
      return {
        label,
        result,
        outcome: nat === 20 ? "20 natural!" : nat === 1 ? "1 natural…" : null,
        tone: nat === 20 ? "critical" : nat === 1 ? "fumble" : "neutral",
      };
    }

    case "d100-roll-under": {
      const target = value;
      // Bonus/penalty die: roll an extra tens die and keep the lower/higher result.
      const units = rng(10) - 1;
      const tensRolls = dice(req.mode && req.mode !== "normal" ? 2 : 1, 10, rng).map((t) => (t - 1) * 10);
      const values = tensRolls.map((t) => (t + units === 0 ? 100 : t + units));
      const r = req.mode === "advantage" ? Math.min(...values) : req.mode === "disadvantage" ? Math.max(...values) : values[0];
      let keptOnce = false;
      const result: RollResult = {
        formula: "1d100",
        mode: req.mode ?? "normal",
        dice: values.map((v) => {
          const keep = !keptOnce && v === r;
          if (keep) keptOnce = true;
          return { sides: 100, value: v, kept: keep };
        }),
        modifier: 0,
        total: r,
        natural: null,
      };
      const fumble = r === 100 || (target < 50 && r >= 96);
      const [outcome, tone]: [string, CheckResult["tone"]] =
        r === 1 ? ["Crítico!", "critical"] : fumble ? ["Desastre", "fumble"] : r <= Math.floor(target / 5) ? ["Sucesso extremo", "success"] : r <= Math.floor(target / 2) ? ["Sucesso difícil", "success"] : r <= target ? ["Sucesso", "success"] : ["Falha", "failure"];
      return { label: `${label} · alvo ${target}`, result: { ...result, formula: `1d100 ≤ ${target}` }, outcome, tone };
    }

    case "d10-dice-pool": {
      const pool = value;
      const values = dice(pool, 10, rng);
      const successes = values.filter((v) => v >= 6).length;
      const tens = values.filter((v) => v === 10).length;
      const total = successes + Math.floor(tens / 2) * 2;
      const result: RollResult = { formula: `${pool}d10 ≥ 6`, mode: "normal", dice: values.map((v) => ({ sides: 10, value: v, kept: v >= 6 })), modifier: 0, total, natural: null };
      return {
        label,
        result,
        outcome: tens >= 2 ? `${total} sucessos (crítico)` : `${total} ${total === 1 ? "sucesso" : "sucessos"}`,
        tone: tens >= 2 ? "critical" : total > 0 ? "success" : "failure",
      };
    }

    case "d20-pool-keep-highest": {
      const n = poolDice <= 0 ? 2 : poolDice;
      const values = dice(n, 20, rng);
      const kept = poolDice <= 0 ? Math.min(...values) : Math.max(...values);
      let keptOnce = false;
      const bonus = value;
      const result: RollResult = {
        formula: `${n}d20${poolDice <= 0 ? "kl1" : "kh1"}${bonus ? signed(bonus) : ""}`,
        mode: "normal",
        dice: values.map((v) => {
          const keep = !keptOnce && v === kept;
          if (keep) keptOnce = true;
          return { sides: 20, value: v, kept: keep };
        }),
        modifier: bonus,
        total: kept + bonus,
        natural: kept,
      };
      return { label, result, outcome: kept === 20 ? "20 natural!" : null, tone: kept === 20 ? "critical" : "neutral" };
    }

    case "d6-plus-attribute": {
      const result = roll(`1d6${signed(value)}`, "normal", rng);
      const six = result.dice[0]?.value === 6;
      return { label, result, outcome: six ? "6 no dado: crítico!" : null, tone: six ? "critical" : "neutral" };
    }

    case "d10-plus-stat-skill": {
      const base = value;
      const first = rng(10);
      const extra = first === 10 || first === 1 ? rng(10) : 0;
      const rolled = first === 10 ? first + extra : first === 1 ? first - extra : first;
      const result: RollResult = {
        formula: `1d10${signed(base)}`,
        mode: "normal",
        dice: [{ sides: 10, value: first, kept: true }, ...(extra ? [{ sides: 10, value: extra, kept: true }] : [])],
        modifier: base,
        total: rolled + base,
        natural: null,
      };
      return {
        label,
        result,
        outcome: first === 10 ? "Crítico! Dado extra somado" : first === 1 ? "Falha crítica: dado extra subtraído" : null,
        tone: first === 10 ? "critical" : first === 1 ? "fumble" : "neutral",
      };
    }

    case "3d6-roll-under": {
      const target = value;
      const result = roll("3d6", "normal", rng);
      const r = result.total;
      const [outcome, tone]: [string, CheckResult["tone"]] =
        r <= 4 ? ["Sucesso decisivo", "critical"] : r >= 17 ? ["Falha crítica", "fumble"] : r <= target ? [`Sucesso por ${target - r}`, "success"] : [`Falha por ${r - target}`, "failure"];
      return { label: `${label} · alvo ${target}`, result: { ...result, formula: `3d6 ≤ ${target}` }, outcome, tone };
    }

    case "custom":
    default: {
      const result = roll(`1${system.dice.primaryDie}${signed(value)}`, req.mode ?? "normal", rng);
      return { label, result, outcome: null, tone: "neutral" };
    }
  }
}

/** Whether skill checks in this system combine the skill with an attribute. */
export function skillUsesAttribute(system: SystemTemplate): boolean {
  return system.dice.mechanic !== "d100-roll-under" && system.dice.mechanic !== "3d6-roll-under";
}

/** Short hint for the UI: what a click on an attribute/skill will roll. */
export function checkHint(system: SystemTemplate): string {
  switch (system.dice.mechanic) {
    case "d20-plus-modifier":
      return "1d20 + modificador (+ proficiência se treinado)";
    case "d100-roll-under":
      return "1d100 abaixo do valor";
    case "d10-dice-pool":
      return "parada de d10 (atributo + perícia), sucesso em 6+";
    case "d20-pool-keep-highest":
      return "atributo em d20, mantém o maior, + bônus da perícia";
    case "d6-plus-attribute":
      return "1d6 + característica";
    case "d10-plus-stat-skill":
      return "1d10 + atributo + perícia (10 explode, 1 implode)";
    case "3d6-roll-under":
      return "3d6 abaixo do valor";
    default:
      return `1${system.dice.primaryDie} + valor`;
  }
}
