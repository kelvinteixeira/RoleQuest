/**
 * Pure combat rules per resolution mechanic: attacks (to-hit, the defender's
 * roll where the system has one, damage and armor), initiative, display
 * helpers and the translation of d20-style NPC stat blocks into each
 * system's numbers. Structure only — no rulebook text.
 */
import { critFormula, cryptoRng, parseFormula, roll, type RollMode, type RollResult, type Rng } from "@/features/dice/dice-engine";
import type { DieType, ResolutionMechanic, SystemTemplate } from "@/types/system";
import type { CombatRules, CombatStats, NpcStatBlock, TokenAttack } from "./types";

export const DEFAULT_RULES: CombatRules = { systemId: "dnd5e", mechanic: "d20-plus-modifier", primaryDie: "d20", defenseLabel: "Classe de Armadura" };

export function rulesFor(system: SystemTemplate): CombatRules {
  return { systemId: system.id, family: system.baseSystemId ?? system.id, mechanic: system.dice.mechanic, primaryDie: system.dice.primaryDie, defenseLabel: system.combat.defenseLabel };
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const sidesOf = (die: DieType) => Number(die.slice(1));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Whether the defender rolls against each attack (true) or is a fixed target number (false). */
export function defenseIsRolled(mechanic: ResolutionMechanic): boolean {
  return !(mechanic === "d20-plus-modifier" || mechanic === "d20-pool-keep-highest" || mechanic === "custom");
}

/* ---------- Dice helpers ---------- */

const FLAT = /^[+-]?\d+$/;

function flat(n: number, formula = String(n)): RollResult {
  return { formula, mode: "normal", dice: [], modifier: n, total: n, natural: null };
}

/** Damage accepts dice formulas ("1d8+3") and plain numbers ("2", "0"). */
export function isValidDamage(formula: string): boolean {
  const f = formula.replace(/\s+/g, "");
  if (FLAT.test(f)) return true;
  try {
    parseFormula(f);
    return true;
  } catch {
    return false;
  }
}

function maxRoll(formula: string): RollResult {
  const { terms, modifier } = parseFormula(formula);
  const dice = terms.flatMap((t) => Array.from({ length: t.count }, () => ({ sides: t.sides, value: t.sides, kept: true })));
  const total = terms.reduce((sum, t) => sum + t.sign * t.count * t.sides, modifier);
  return { formula: `${formula} (máximo)`, mode: "normal", dice, modifier, total, natural: null };
}

export function rollDamage(formula: string, rng: Rng = cryptoRng, crit: "none" | "double" | "max" = "none"): RollResult {
  const f = formula.replace(/\s+/g, "");
  if (FLAT.test(f)) return flat(Number(f));
  // An invalid formula on an old sheet should not break the table.
  if (!isValidDamage(f)) return flat(1);
  if (crit === "double") return roll(critFormula(f), "normal", rng);
  if (crit === "max") return maxRoll(f);
  return roll(f, "normal", rng);
}

/** Average of a damage formula, used to translate NPC damage between systems. */
export function averageDamage(formula: string): number {
  const f = formula.replace(/\s+/g, "");
  if (FLAT.test(f)) return Number(f);
  try {
    const { terms, modifier } = parseFormula(f);
    return terms.reduce((sum, t) => sum + (t.sign * t.count * (t.sides + 1)) / 2, modifier);
  } catch {
    return 4;
  }
}

function keepOne(values: number[], kept: number, sides: number) {
  let keptOnce = false;
  return values.map((value) => {
    const keep = !keptOnce && value === kept;
    if (keep) keptOnce = true;
    return { sides, value, kept: keep };
  });
}

/** Ordem Paranormal style: N d20, keep the highest (0 or less: 2d20 keep the lowest). */
function d20Pool(n: number, bonus: number, rng: Rng): RollResult {
  const count = n <= 0 ? 2 : n;
  const values = Array.from({ length: count }, () => rng(20));
  const kept = n <= 0 ? Math.min(...values) : Math.max(...values);
  return { formula: `${count}d20${n <= 0 ? "kl1" : "kh1"}${bonus ? signed(bonus) : ""}`, mode: "normal", dice: keepOne(values, kept, 20), modifier: bonus, total: kept + bonus, natural: kept };
}

/** Storyteller pool: successes on 6+, each pair of 10s adds two more. */
function d10Pool(size: number, rng: Rng): { result: RollResult; successes: number; critical: boolean } {
  const pool = Math.max(1, size);
  const values = Array.from({ length: pool }, () => rng(10));
  const tens = values.filter((v) => v === 10).length;
  const successes = values.filter((v) => v >= 6).length + Math.floor(tens / 2) * 2;
  const result: RollResult = { formula: `${pool}d10 ≥ 6`, mode: "normal", dice: values.map((v) => ({ sides: 10, value: v, kept: v >= 6 })), modifier: 0, total: successes, natural: null };
  return { result, successes, critical: tens >= 2 };
}

const LEVEL_LABEL = ["Falha", "Sucesso", "Sucesso difícil", "Sucesso extremo", "Crítico!"] as const;

/** d100 roll-under success level: 0 failure · 1 regular · 2 hard · 3 extreme · 4 critical. */
export function successLevel(r: number, target: number): number {
  if (r === 1) return 4;
  if (r === 100 || (target < 50 && r >= 96)) return 0;
  if (r <= Math.floor(target / 5)) return 3;
  if (r <= Math.floor(target / 2)) return 2;
  return r <= target ? 1 : 0;
}

/** d100 with bonus/penalty die (advantage keeps the lower result). */
function d100(target: number, rng: Rng, mode: RollMode): { result: RollResult; level: number } {
  const units = rng(10) - 1;
  const tens = Array.from({ length: mode === "normal" ? 1 : 2 }, () => (rng(10) - 1) * 10);
  const values = tens.map((t) => (t + units === 0 ? 100 : t + units));
  const r = mode === "advantage" ? Math.min(...values) : mode === "disadvantage" ? Math.max(...values) : values[0];
  return {
    result: { formula: `1d100 ≤ ${target}`, mode, dice: keepOne(values, r, 100), modifier: 0, total: r, natural: null },
    level: successLevel(r, target),
  };
}

/** Cyberpunk style: 10 adds another d10, 1 subtracts one. */
function explodingD10(bonus: number, rng: Rng): { result: RollResult; critical: boolean; fumble: boolean } {
  const first = rng(10);
  const extra = first === 10 || first === 1 ? rng(10) : 0;
  const value = first === 10 ? first + extra : first === 1 ? first - extra : first;
  return {
    result: {
      formula: `1d10${signed(bonus)}`,
      mode: "normal",
      dice: [{ sides: 10, value: first, kept: true }, ...(extra ? [{ sides: 10, value: extra, kept: true }] : [])],
      modifier: bonus,
      total: value + bonus,
      natural: null,
    },
    critical: first === 10,
    fumble: first === 1,
  };
}

/** GURPS style: 3d6 ≤ target; 3–4 always succeed (critical), 17–18 always fail. */
function threeD6(target: number, rng: Rng) {
  const base = roll("3d6", "normal", rng);
  const r = base.total;
  const critical = r <= 4;
  const fumble = r >= 17;
  const success = critical || (!fumble && r <= target);
  const outcome = critical ? "Sucesso decisivo" : fumble ? "Falha crítica" : success ? `Sucesso por ${target - r}` : `Falha por ${r - target}`;
  return { result: { ...base, formula: `3d6 ≤ ${target}` }, success, critical, outcome };
}

/** Margin systems: damage is how much the attack beat the defense, plus the weapon. */
function marginDamage(margin: number, weapon: RollResult): RollResult {
  const weaponText = weapon.dice.length ? ` + ${weapon.formula}` : weapon.total > 0 ? ` + ${weapon.total}` : weapon.total < 0 ? ` - ${-weapon.total}` : "";
  return { formula: `margem ${margin}${weaponText}`, mode: "normal", dice: weapon.dice, modifier: margin + weapon.modifier, total: margin + weapon.total, natural: null };
}

/* ---------- Attacks ---------- */

export interface CombatRoll {
  by: "attacker" | "defender";
  kind: "attack" | "defense" | "damage";
  result: RollResult;
  /** Short outcome shown next to the roll ("Sucesso difícil", "2 sucessos"). */
  outcome: string | null;
}

export interface AttackResolution {
  rolls: CombatRoll[];
  hit: boolean;
  critical: boolean;
  /** Damage dealt after armor. */
  damage: number;
  /** Damage stopped by armor. */
  absorbed: number;
}

const successes = (n: number) => `${n} ${n === 1 ? "sucesso" : "sucessos"}`;

/**
 * Resolves one attack with the room's mechanic. The defender's roll (if the
 * system has one) is part of the result, so the chat can show both sides.
 */
export function resolveAttack(
  rules: CombatRules,
  attack: TokenAttack,
  defender: Pick<CombatStats, "defense" | "armor">,
  options: { mode?: RollMode; rng?: Rng } = {},
): AttackResolution {
  const rng = options.rng ?? cryptoRng;
  const mode = options.mode ?? "normal";
  const rolls: CombatRoll[] = [];
  const attackRoll = (result: RollResult, outcome: string | null) => rolls.push({ by: "attacker", kind: "attack", result, outcome });
  const defenseRoll = (result: RollResult, outcome: string | null) => rolls.push({ by: "defender", kind: "defense", result, outcome });
  const miss = (): AttackResolution => ({ rolls, hit: false, critical: false, damage: 0, absorbed: 0 });
  const land = (raw: RollResult, critical: boolean): AttackResolution => {
    rolls.push({ by: "attacker", kind: "damage", result: raw, outcome: critical ? "Crítico!" : null });
    const armor = Math.max(0, defender.armor);
    const before = Math.max(0, raw.total);
    const absorbed = Math.min(before, armor);
    // Without armor a hit always hurts a little; armor can stop a blow completely.
    const damage = armor > 0 ? before - absorbed : Math.max(1, before);
    return { rolls, hit: true, critical, damage, absorbed };
  };

  switch (rules.mechanic) {
    case "d20-plus-modifier":
    case "custom": {
      const sides = rules.mechanic === "custom" ? sidesOf(rules.primaryDie) : 20;
      const d20 = sides === 20;
      const toHit = roll(`1d${sides}${signed(attack.value)}`, d20 ? mode : "normal", rng);
      const nat = toHit.dice.find((d) => d.kept)?.value ?? 0;
      // Natural 20 always hits, natural 1 always misses; Pathfinder also crits by beating the defense by 10.
      const autoMiss = d20 && nat === 1;
      const critical = d20 && !autoMiss && (nat === 20 || ((rules.family ?? rules.systemId) === "pathfinder2e" && toHit.total >= defender.defense + 10));
      const hit = critical || (!autoMiss && toHit.total >= defender.defense);
      attackRoll(toHit, critical ? "Crítico!" : hit ? "Acerto" : autoMiss ? "1 natural" : "Erro");
      return hit ? land(rollDamage(attack.damage, rng, critical ? "double" : "none"), critical) : miss();
    }

    case "d20-pool-keep-highest": {
      const toHit = d20Pool(attack.dice ?? 1, attack.value, rng);
      const critical = toHit.natural === 20;
      const hit = critical || toHit.total >= defender.defense;
      attackRoll(toHit, critical ? "Crítico!" : hit ? "Acerto" : "Erro");
      return hit ? land(rollDamage(attack.damage, rng, critical ? "double" : "none"), critical) : miss();
    }

    case "d100-roll-under": {
      const a = d100(attack.value, rng, mode);
      attackRoll(a.result, LEVEL_LABEL[a.level]);
      if (a.level === 0) return miss();
      // The defender dodges; an equal or better success level avoids the blow.
      const d = d100(defender.defense, rng, "normal");
      defenseRoll(d.result, d.level >= a.level ? `${LEVEL_LABEL[d.level]}: esquivou` : LEVEL_LABEL[d.level]);
      if (d.level >= a.level) return miss();
      const critical = a.level >= 3;
      return land(rollDamage(attack.damage, rng, critical ? "max" : "none"), critical);
    }

    case "d10-dice-pool": {
      const a = d10Pool(attack.value, rng);
      attackRoll(a.result, a.critical ? `${successes(a.successes)} (crítico)` : successes(a.successes));
      const d = d10Pool(defender.defense, rng);
      defenseRoll(d.result, successes(d.successes));
      const margin = a.successes - d.successes;
      return margin > 0 ? land(marginDamage(margin, rollDamage(attack.damage, rng)), a.critical) : miss();
    }

    case "d6-plus-attribute": {
      // A 6 on the die doubles the attribute (critical); damage is attack minus defense.
      const die = rng(6);
      const critical = die === 6;
      const bonus = attack.value * (critical ? 2 : 1);
      const toHit: RollResult = { formula: `1d6${signed(bonus)}${critical ? " (×2)" : ""}`, mode: "normal", dice: [{ sides: 6, value: die, kept: true }], modifier: bonus, total: die + bonus, natural: null };
      attackRoll(toHit, critical ? "6 no dado: crítico!" : null);
      const def = roll(`1d6${signed(defender.defense)}`, "normal", rng);
      const margin = toHit.total - def.total;
      defenseRoll(def, margin > 0 ? null : "Bloqueou");
      return margin > 0 ? land(marginDamage(margin, rollDamage(attack.damage, rng)), critical) : miss();
    }

    case "d10-plus-stat-skill": {
      const a = explodingD10(attack.value, rng);
      attackRoll(a.result, a.critical ? "10 no dado: dado extra" : a.fumble ? "1 no dado: dado extra subtraído" : null);
      const d = explodingD10(defender.defense, rng);
      // Ties favour the defender.
      const hit = a.result.total > d.result.total;
      defenseRoll(d.result, hit ? null : "Esquivou");
      if (!hit) return miss();
      const dmg = rollDamage(attack.damage, rng);
      // Two or more 6s on the damage dice: critical injury, +5 damage.
      const critical = dmg.dice.filter((x) => x.sides === 6 && x.value === 6).length >= 2;
      return land(critical ? { ...dmg, formula: `${dmg.formula} + 5`, modifier: dmg.modifier + 5, total: dmg.total + 5 } : dmg, critical);
    }

    case "3d6-roll-under": {
      const a = threeD6(attack.value, rng);
      attackRoll(a.result, a.outcome);
      if (!a.success) return miss();
      // A critical hit cannot be defended.
      if (!a.critical) {
        const d = threeD6(defender.defense, rng);
        defenseRoll(d.result, d.success ? `${d.outcome}: defendeu` : d.outcome);
        if (d.success) return miss();
      }
      return land(rollDamage(attack.damage, rng, a.critical ? "max" : "none"), a.critical);
    }
  }
}

/* ---------- Initiative ---------- */

/** Initiative total for one combatant. Systems without an initiative roll use the score itself. */
export function rollInitiativeFor(rules: CombatRules, stats: Pick<CombatStats, "initiative" | "initiativeDice">, rng: Rng = cryptoRng): number {
  const bonus = stats.initiative;
  switch (rules.mechanic) {
    case "d20-plus-modifier":
      return roll(`1d20${signed(bonus)}`, "normal", rng).total;
    case "d20-pool-keep-highest":
      return d20Pool(stats.initiativeDice ?? 1, bonus, rng).total;
    case "d100-roll-under":
    case "3d6-roll-under":
      return bonus;
    case "d10-dice-pool":
    case "d10-plus-stat-skill":
      return rng(10) + bonus;
    case "d6-plus-attribute":
      return rng(6) + bonus;
    case "custom":
      return rng(sidesOf(rules.primaryDie)) + bonus;
  }
}

/* ---------- Display ---------- */

export function formatAttackValue(rules: CombatRules, attack: Pick<TokenAttack, "value" | "dice">): string {
  switch (rules.mechanic) {
    case "d20-pool-keep-highest":
      return `${attack.dice ?? 1}d20${attack.value ? signed(attack.value) : ""}`;
    case "d100-roll-under":
      return `${attack.value}%`;
    case "d10-dice-pool":
      return `${attack.value}d10`;
    case "3d6-roll-under":
      return `≤ ${attack.value}`;
    default:
      return signed(attack.value);
  }
}

export function formatDefense(rules: CombatRules, defense: number): string {
  switch (rules.mechanic) {
    case "d100-roll-under":
      return `${defense}%`;
    case "d10-dice-pool":
      return `${defense}d10`;
    case "3d6-roll-under":
      return `≤ ${defense}`;
    case "d6-plus-attribute":
    case "d10-plus-stat-skill":
      return signed(defense);
    default:
      return String(defense);
  }
}

export function formatInitiative(rules: CombatRules, stats: Pick<CombatStats, "initiative" | "initiativeDice">): string {
  switch (rules.mechanic) {
    case "d20-pool-keep-highest":
      return `${stats.initiativeDice ?? 1}d20${stats.initiative ? signed(stats.initiative) : ""}`;
    case "d100-roll-under":
    case "3d6-roll-under":
      return Number.isInteger(stats.initiative) ? String(stats.initiative) : stats.initiative.toFixed(2);
    default:
      return signed(stats.initiative);
  }
}

/** One line describing how an attack is resolved in this room. */
export function attackRuleHint(rules: CombatRules): string {
  switch (rules.mechanic) {
    case "d20-plus-modifier":
      return `1d20 + ataque contra ${rules.defenseLabel}; 20 natural é crítico (dados de dano dobrados)${(rules.family ?? rules.systemId) === "pathfinder2e" ? ", superar por 10 também" : ""}.`;
    case "d20-pool-keep-highest":
      return `Atributo em d20, mantém o maior, + perícia contra ${rules.defenseLabel}; 20 é crítico.`;
    case "d100-roll-under":
      return "1d100 abaixo da perícia; o alvo rola Esquivar e evita com nível de sucesso igual ou maior. Extremo causa dano máximo.";
    case "d10-dice-pool":
      return "Parada de ataque contra parada de defesa; o dano é a margem de sucessos + a arma.";
    case "d6-plus-attribute":
      return "1d6 + ataque contra 1d6 + defesa; o dano é a diferença (+ dano extra). 6 no dado dobra o atributo.";
    case "d10-plus-stat-skill":
      return "1d10 + atributo + perícia contra 1d10 + defesa do alvo; empate favorece quem defende. Armadura reduz o dano.";
    case "3d6-roll-under":
      return "3d6 abaixo da perícia; o alvo tenta a defesa ativa (3d6). Sucesso decisivo não pode ser defendido. RD reduz o dano.";
    case "custom":
      return `1${rules.primaryDie} + ataque contra ${rules.defenseLabel}.`;
  }
}

/** Healing used by support bots, in the scale of each system's health track. */
export function healFormula(rules: CombatRules): string {
  switch (rules.mechanic) {
    case "d100-roll-under":
    case "d10-dice-pool":
    case "d6-plus-attribute":
      return "1d3";
    case "d10-plus-stat-skill":
      return "1d6+2";
    case "3d6-roll-under":
      return "1d6";
    default:
      return "1d8+3";
  }
}

/* ---------- NPCs ---------- */

/**
 * Translates a d20-style stat block (AC-like defense, attack bonus, damage
 * dice, hit points) into the numbers of the room's system, keeping roughly
 * the same threat against a starting character.
 */
export function adaptNpcStats(rules: CombatRules, npc: NpcStatBlock): { stats: CombatStats; hp: number } {
  const avg = averageDamage(npc.damage);
  const make = (hp: number, stats: Omit<CombatStats, "attacks" | "speed" | "heals"> & { value: number; dice?: number; damage?: string }) => {
    const { value, dice, damage, ...rest } = stats;
    return {
      hp: Math.max(1, Math.round(hp)),
      stats: {
        ...rest,
        speed: npc.speed,
        heals: npc.heals,
        attacks: [{ id: "npc-attack", name: npc.attackName ?? "Ataque", value, dice, damage: damage ?? npc.damage, range: npc.range ?? 1 }],
      },
    };
  };

  switch (rules.mechanic) {
    case "d20-plus-modifier":
      return make(npc.hp, { defense: npc.defense, armor: 0, initiative: npc.initiativeBonus, value: npc.attackBonus });
    case "d20-pool-keep-highest":
      return make(npc.hp * 1.5, { defense: npc.defense, armor: 0, initiative: Math.floor(npc.initiativeBonus / 2), initiativeDice: 2, value: Math.floor(npc.attackBonus / 2), dice: 2 });
    case "d100-roll-under":
      return make(Math.max(4, npc.hp * 0.5), {
        defense: clamp((npc.defense - 10) * 6, 10, 60),
        armor: 0,
        initiative: clamp(40 + npc.initiativeBonus * 5, 15, 90),
        value: clamp(25 + npc.attackBonus * 5, 20, 80),
      });
    case "d10-dice-pool":
      return make(3 + npc.hp / 8, {
        defense: 2 + Math.floor((npc.defense - 10) / 2),
        armor: 0,
        initiative: 2 + Math.floor(npc.initiativeBonus / 2),
        value: 3 + Math.floor(npc.attackBonus / 2),
        damage: String(Math.floor(avg / 4)),
      });
    case "d6-plus-attribute":
      return make(Math.max(3, npc.hp / 3), {
        defense: Math.max(0, Math.floor((npc.defense - 10) / 2)),
        armor: 0,
        initiative: Math.max(0, Math.floor(npc.initiativeBonus / 2)),
        value: 1 + Math.floor(npc.attackBonus / 3),
        damage: "0",
      });
    case "d10-plus-stat-skill":
      return make(npc.hp * 1.2 + 5, {
        defense: npc.defense - 4,
        armor: Math.max(0, Math.floor((npc.defense - 11) / 2)),
        initiative: 5 + npc.initiativeBonus,
        value: npc.attackBonus + 6,
        damage: `${Math.max(1, Math.round(avg / 3.5))}d6`,
      });
    case "3d6-roll-under":
      return make(npc.hp * 0.4 + 5, {
        defense: 6 + Math.floor((npc.defense - 10) / 2),
        armor: Math.max(0, Math.floor((npc.defense - 12) / 2)),
        initiative: 5 + npc.initiativeBonus / 4,
        value: 10 + Math.floor(npc.attackBonus / 2),
      });
    case "custom": {
      const scale = sidesOf(rules.primaryDie) / 20;
      return make(npc.hp, { defense: Math.max(1, Math.round(npc.defense * scale)), armor: 0, initiative: Math.round(npc.initiativeBonus * scale), value: Math.round(npc.attackBonus * scale) });
    }
  }
}
