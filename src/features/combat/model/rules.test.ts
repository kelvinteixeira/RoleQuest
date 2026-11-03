import { describe, expect, it } from "vitest";
import { scriptedRng } from "@/test/rng";
import type { ResolutionMechanic, SystemId } from "@/types/system";
import { adaptNpcStats, isValidDamage, resolveAttack, rollInitiativeFor } from "./rules";
import type { CombatRules, NpcStatBlock, TokenAttack } from "./types";

const rules = (mechanic: ResolutionMechanic, systemId: SystemId = "dnd5e"): CombatRules => ({ systemId, mechanic, primaryDie: "d20", defenseLabel: "Defesa" });
const weapon = (value: number, damage: string, extra: Partial<TokenAttack> = {}): TokenAttack => ({ id: "a", name: "Arma", value, damage, range: 1, ...extra });
const target = (defense: number, armor = 0) => ({ defense, armor });

describe("d20 + modifier", () => {
  const d20 = rules("d20-plus-modifier");

  it("hits when the total reaches the defense and rolls the weapon damage", () => {
    const r = resolveAttack(d20, weapon(5, "1d8+3"), target(15), { rng: scriptedRng(10, 4) });
    expect(r).toMatchObject({ hit: true, critical: false, damage: 7 });
    expect(r.rolls.map((x) => x.kind)).toEqual(["attack", "damage"]);
  });

  it("misses on a natural 1 whatever the bonus", () => {
    const r = resolveAttack(d20, weapon(30, "1d8"), target(10), { rng: scriptedRng(1) });
    expect(r.hit).toBe(false);
    expect(r.rolls).toHaveLength(1);
  });

  it("doubles the damage dice on a natural 20", () => {
    const r = resolveAttack(d20, weapon(0, "1d8+3"), target(30), { rng: scriptedRng(20, 1, 2) });
    expect(r).toMatchObject({ hit: true, critical: true, damage: 6 });
  });

  it("crits in Pathfinder by beating the defense by 10", () => {
    const r = resolveAttack(rules("d20-plus-modifier", "pathfinder2e"), weapon(10, "1d6"), target(15), { rng: scriptedRng(15, 3, 3) });
    expect(r).toMatchObject({ critical: true, damage: 6 });
  });

  it("lets armor absorb a weak blow completely", () => {
    const r = resolveAttack(d20, weapon(5, "1d4"), target(12, 3), { rng: scriptedRng(15, 2) });
    expect(r).toMatchObject({ hit: true, damage: 0, absorbed: 2 });
  });
});

describe("d100 roll-under with a dodge", () => {
  const coc = rules("d100-roll-under", "call-of-cthulhu");

  it("hits when the attack's success level beats the dodge", () => {
    // Attack 20 vs 50 (hard), dodge 25 vs 30 (regular), damage 1d3 → 2.
    const r = resolveAttack(coc, weapon(50, "1d3"), target(30), { rng: scriptedRng(1, 3, 6, 3, 2) });
    expect(r).toMatchObject({ hit: true, damage: 2 });
    expect(r.rolls.map((x) => [x.by, x.outcome])).toEqual([
      ["attacker", "Sucesso difícil"],
      ["defender", "Sucesso"],
      ["attacker", null],
    ]);
  });

  it("does not ask for a dodge when the attack fails", () => {
    const r = resolveAttack(coc, weapon(50, "1d3"), target(30), { rng: scriptedRng(1, 9) });
    expect(r.hit).toBe(false);
    expect(r.rolls).toHaveLength(1);
  });

  it("lets an equal success level dodge the blow", () => {
    const r = resolveAttack(coc, weapon(50, "1d3"), target(30), { rng: scriptedRng(1, 5, 9, 3) });
    expect(r.hit).toBe(false);
    expect(r.rolls[1].outcome).toContain("esquivou");
  });

  it("deals maximum damage on an extreme success", () => {
    const rng = scriptedRng(6, 1, 1, 10);
    const r = resolveAttack(coc, weapon(50, "1d6+1"), target(30), { rng });
    expect(r).toMatchObject({ hit: true, critical: true, damage: 7 });
    expect(rng.remaining()).toBe(0);
  });
});

describe("opposed systems", () => {
  it("d10 pool: damage is the margin of successes plus the weapon", () => {
    const r = resolveAttack(rules("d10-dice-pool", "vampire-masquerade"), weapon(4, "1"), target(2), { rng: scriptedRng(6, 7, 2, 10, 3, 8) });
    expect(r).toMatchObject({ hit: true, damage: 3 });
    expect(r.rolls[2].result.formula).toBe("margem 2 + 1");
  });

  it("d10 pool: a tie is a miss", () => {
    const r = resolveAttack(rules("d10-dice-pool", "vampire-masquerade"), weapon(1, "0"), target(1), { rng: scriptedRng(6, 9) });
    expect(r.hit).toBe(false);
  });

  it("1d6 + attribute: a 6 doubles the attribute and damage is the difference", () => {
    const r = resolveAttack(rules("d6-plus-attribute", "3dt-victory"), weapon(2, "0"), target(1), { rng: scriptedRng(6, 3) });
    expect(r).toMatchObject({ hit: true, critical: true, damage: 6 });
  });

  it("1d10 + stat: ties favour the defender", () => {
    const r = resolveAttack(rules("d10-plus-stat-skill", "cyberpunk-red"), weapon(12, "3d6"), target(10), { rng: scriptedRng(5, 7) });
    expect(r.hit).toBe(false);
  });

  it("1d10 + stat: two 6s on the damage add 5, armor still applies", () => {
    const r = resolveAttack(rules("d10-plus-stat-skill", "cyberpunk-red"), weapon(12, "3d6"), target(10, 4), { rng: scriptedRng(8, 2, 6, 6, 1) });
    expect(r).toMatchObject({ hit: true, critical: true, damage: 14, absorbed: 4 });
  });

  it("3d6: a critical success cannot be defended and deals maximum damage", () => {
    const rng = scriptedRng(1, 1, 2);
    const r = resolveAttack(rules("3d6-roll-under", "gurps"), weapon(12, "1d6+1"), target(9), { rng });
    expect(r).toMatchObject({ hit: true, critical: true, damage: 7 });
    expect(r.rolls.some((x) => x.kind === "defense")).toBe(false);
    expect(rng.remaining()).toBe(0);
  });

  it("3d6: a successful active defense stops the attack", () => {
    const r = resolveAttack(rules("3d6-roll-under", "gurps"), weapon(12, "1d6"), target(9), { rng: scriptedRng(3, 4, 3, 2, 3, 3) });
    expect(r.hit).toBe(false);
    expect(r.rolls).toHaveLength(2);
  });
});

describe("initiative", () => {
  it("uses the score itself in systems without an initiative roll", () => {
    expect(rollInitiativeFor(rules("d100-roll-under", "call-of-cthulhu"), { initiative: 60 }, scriptedRng())).toBe(60);
  });

  it("rolls the system's die", () => {
    expect(rollInitiativeFor(rules("d20-plus-modifier"), { initiative: 3 }, scriptedRng(12))).toBe(15);
    expect(rollInitiativeFor(rules("d20-pool-keep-highest", "ordem-paranormal"), { initiative: 1, initiativeDice: 2 }, scriptedRng(5, 17))).toBe(18);
  });
});

describe("NPC stat blocks", () => {
  const boss: NpcStatBlock = { hp: 38, defense: 15, attackBonus: 6, damage: "2d6+3", speed: 4, initiativeBonus: -1 };
  const mechanics: ResolutionMechanic[] = ["d20-plus-modifier", "d20-pool-keep-highest", "d100-roll-under", "d10-dice-pool", "d6-plus-attribute", "d10-plus-stat-skill", "3d6-roll-under", "custom"];

  it.each(mechanics)("%s: produces a usable block", (mechanic) => {
    const { stats, hp } = adaptNpcStats(rules(mechanic), boss);
    expect(hp).toBeGreaterThanOrEqual(1);
    expect(stats.attacks).toHaveLength(1);
    expect(isValidDamage(stats.attacks[0].damage)).toBe(true);
    expect(stats.speed).toBe(4);
  });

  it("translates to each system's scale", () => {
    expect(adaptNpcStats(rules("d100-roll-under"), boss).stats).toMatchObject({ defense: 30, attacks: [{ value: 55 }] });
    expect(adaptNpcStats(rules("d10-dice-pool"), boss)).toMatchObject({ hp: 8, stats: { defense: 4, attacks: [{ value: 6, damage: "2" }] } });
    expect(adaptNpcStats(rules("d10-plus-stat-skill"), boss).stats).toMatchObject({ defense: 11, armor: 2, attacks: [{ value: 12, damage: "3d6" }] });
    expect(adaptNpcStats(rules("3d6-roll-under"), boss).stats).toMatchObject({ defense: 8, armor: 1, attacks: [{ value: 13 }] });
  });
});
