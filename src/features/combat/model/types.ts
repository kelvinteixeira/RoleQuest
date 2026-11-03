import type { DieType, ResolutionMechanic, SystemId } from "@/types/system";

/** Room-wide combat rules, taken from the campaign's system. */
export interface CombatRules {
  systemId: SystemId;
  mechanic: ResolutionMechanic;
  /** Main die of "custom" systems (attacks and initiative roll it). */
  primaryDie: DieType;
  /** "Classe de Armadura", "Esquivar"… shown next to the defense value. */
  defenseLabel: string;
}

/**
 * One attack a token can make. `value` is read by the room's mechanic:
 * - d20 + modifier, custom, 1d6 + attribute, 1d10 + stat: bonus added to the die
 * - d20 keep-highest: bonus added to the kept die (`dice` d20s are rolled)
 * - d100 roll-under: skill percentage
 * - d10 dice pool: dice in the pool
 * - 3d6 roll-under: skill target
 */
export interface TokenAttack {
  id: string;
  name: string;
  value: number;
  /** d20 keep-highest only: how many d20s to roll. */
  dice?: number;
  /** Damage formula ("1d8+3") or a flat number ("2"). Margin systems add it to the margin. */
  damage: string;
  /** Reach in squares; 1 = melee. */
  range: number;
}

/**
 * Combat block of a token. Player characters derive it from their sheet;
 * enemies and bots from an `NpcStatBlock` adapted to the room's system.
 */
export interface CombatStats {
  /**
   * Static target in d20-style systems (AC, Defesa); the defender's own roll
   * value elsewhere (dodge %, defense pool, active defense target, defense bonus).
   */
  defense: number;
  /** Damage reduction (armor SP, DR). */
  armor: number;
  /** Squares per turn. */
  speed: number;
  /** Initiative modifier, or the static score in systems that don't roll (CoC DEX, GURPS Basic Speed). */
  initiative: number;
  /** d20 keep-highest only: how many d20s initiative rolls. */
  initiativeDice?: number;
  attacks: TokenAttack[];
  /** Healing uses per combat (bots with a support role). */
  heals?: number;
}

/**
 * Enemy/bot stat block authored once in d20 terms (defense ≈ AC, attack
 * bonus, damage dice) and translated to each system by `adaptNpcStats`.
 */
export interface NpcStatBlock {
  hp: number;
  defense: number;
  attackBonus: number;
  damage: string;
  speed: number;
  initiativeBonus: number;
  attackName?: string;
  range?: number;
  heals?: number;
}
