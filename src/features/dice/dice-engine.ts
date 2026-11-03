/**
 * Pure dice engine: parses formulas like "1d20+5", "2d6+1d8-1" or "d100"
 * and rolls them with a cryptographic RNG. Used by the room, chat commands
 * and bots. No React, no store: easy to test and to run on a server later.
 */

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface DieRoll {
  sides: number;
  value: number;
  /** False for the discarded die of an advantage/disadvantage pair. */
  kept: boolean;
}

export interface RollResult {
  formula: string;
  mode: RollMode;
  dice: DieRoll[];
  modifier: number;
  total: number;
  /** Natural d20 result when the formula is a single d20 (crit/fumble detection). */
  natural: number | null;
}

interface DiceTerm {
  count: number;
  sides: number;
  sign: 1 | -1;
}

const MAX_DICE = 100;
const ALLOWED_SIDES = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100]);

export class DiceFormulaError extends Error {}

export function parseFormula(input: string): { terms: DiceTerm[]; modifier: number } {
  const formula = input.replace(/\s+/g, "").toLowerCase();
  if (!formula) throw new DiceFormulaError("Fórmula vazia.");
  const tokens = formula.match(/[+-]?[^+-]+/g);
  if (!tokens || tokens.join("") !== formula) throw new DiceFormulaError(`Fórmula inválida: ${input}`);

  const terms: DiceTerm[] = [];
  let modifier = 0;
  let totalDice = 0;
  for (const raw of tokens) {
    const sign: 1 | -1 = raw.startsWith("-") ? -1 : 1;
    const body = raw.replace(/^[+-]/, "");
    const dice = body.match(/^(\d*)d(\d+)$/);
    if (dice) {
      const count = dice[1] === "" ? 1 : Number(dice[1]);
      const sides = Number(dice[2]);
      if (!ALLOWED_SIDES.has(sides)) throw new DiceFormulaError(`Dado d${sides} não suportado.`);
      if (count < 1) throw new DiceFormulaError("Quantidade de dados inválida.");
      totalDice += count;
      terms.push({ count, sides, sign });
    } else if (/^\d+$/.test(body)) {
      modifier += sign * Number(body);
    } else {
      throw new DiceFormulaError(`Termo inválido: ${raw}`);
    }
  }
  if (terms.length === 0) throw new DiceFormulaError("A fórmula precisa de pelo menos um dado.");
  if (totalDice > MAX_DICE) throw new DiceFormulaError(`Máximo de ${MAX_DICE} dados por rolagem.`);
  return { terms, modifier };
}

export type Rng = (sides: number) => number;

/** Uniform 1..sides using crypto, with rejection sampling to avoid modulo bias. */
export const cryptoRng: Rng = (sides) => {
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return (value % sides) + 1;
};

/** Advantage/disadvantage only make sense for a single d20. */
export function supportsAdvantage(formula: string): boolean {
  try {
    const { terms } = parseFormula(formula);
    return terms.length === 1 && terms[0].count === 1 && terms[0].sides === 20;
  } catch {
    return false;
  }
}

export function roll(formula: string, mode: RollMode = "normal", rng: Rng = cryptoRng): RollResult {
  const { terms, modifier } = parseFormula(formula);
  const effectiveMode = mode !== "normal" && supportsAdvantage(formula) ? mode : "normal";
  const dice: DieRoll[] = [];
  let total = modifier;

  for (const term of terms) {
    if (effectiveMode !== "normal") {
      const a = rng(20);
      const b = rng(20);
      const keepA = effectiveMode === "advantage" ? a >= b : a <= b;
      dice.push({ sides: 20, value: a, kept: keepA }, { sides: 20, value: b, kept: !keepA });
      total += term.sign * (keepA ? a : b);
      continue;
    }
    for (let i = 0; i < term.count; i++) {
      const value = rng(term.sides);
      dice.push({ sides: term.sides, value, kept: true });
      total += term.sign * value;
    }
  }

  const single = terms.length === 1 && terms[0].sides === 20 && terms[0].count === 1;
  return {
    formula: normalizeFormula(terms, modifier),
    mode: effectiveMode,
    dice,
    modifier,
    total,
    natural: single ? (dice.find((d) => d.kept)?.value ?? null) : null,
  };
}

function normalizeFormula(terms: DiceTerm[], modifier: number): string {
  const parts = terms.map((t, i) => `${i === 0 ? (t.sign < 0 ? "-" : "") : t.sign < 0 ? " - " : " + "}${t.count}d${t.sides}`);
  if (modifier !== 0) parts.push(modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`);
  return parts.join("");
}

/** Doubles the dice of a damage formula for critical hits ("1d8+3" → "2d8+3"). */
export function critFormula(formula: string): string {
  const { terms, modifier } = parseFormula(formula);
  return normalizeFormula(
    terms.map((t) => ({ ...t, count: t.count * 2 })),
    modifier,
  ).replace(/\s+/g, "");
}
