import { describe, expect, it } from "vitest";
import { riverGladeMap } from "@/features/map/model/templates";
import { DEFAULT_RULES, adaptNpcStats } from "@/features/combat/model/rules";
import type { CombatRules, NpcStatBlock } from "@/features/combat/model/types";
import { scriptedRng } from "@/test/rng";
import { decideTurn } from "./bots";
import { freeCellNear } from "./map";
import { applyEvents, attack, createFog, rollInitiative } from "./room-engine";
import { upgradeRoom } from "./room-migration";
import type { RoomState, RoomToken } from "./types";

const COC: CombatRules = { systemId: "call-of-cthulhu", mechanic: "d100-roll-under", primaryDie: "d100", defenseLabel: "Esquivar" };
const skeleton: NpcStatBlock = { hp: 13, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2 };

function token(partial: Partial<RoomToken> & Pick<RoomToken, "id" | "kind">): RoomToken {
  return {
    controller: "gm",
    name: partial.id,
    ownerName: "Mestre",
    concept: "",
    color: "#888",
    x: 0,
    y: 0,
    hp: { current: 10, max: 10 },
    stats: { defense: 12, armor: 0, speed: 6, initiative: 0, attacks: [{ id: "atk", name: "Espada", value: 5, damage: "1d8+3", range: 1 }] },
    conditions: [],
    ...partial,
  };
}

function room(tokens: RoomToken[], rules: CombatRules = DEFAULT_RULES): RoomState {
  return { campaignId: "c1", rules, map: riverGladeMap(), tokens, messages: [], combat: { active: false, round: 0, turn: 0, order: [] }, fog: createFog(), audio: { music: null, ambience: [] }, log: [], createdAt: "2026-01-01" };
}

describe("attack", () => {
  it("posts the rolls, applies damage and announces a downed target", () => {
    const hero = token({ id: "hero", kind: "pc" });
    const foe = token({ id: "foe", kind: "enemy", hp: { current: 5, max: 5 } });
    const state = room([hero, foe]);
    const outcome = attack(state, hero, foe, { rng: scriptedRng(15, 4) });
    expect(outcome).toMatchObject({ hit: true, damage: 7, downed: true });

    const after = applyEvents(state, outcome.events, hero.id);
    const target = after.tokens.find((t) => t.id === "foe")!;
    expect(target.hp.current).toBe(0);
    expect(target.conditions).toContain("Caído");
    const labels = after.messages.map((m) => m.text);
    expect(labels[0]).toMatch(/^Ataque em foe · Espada — Acerto/);
    expect(labels[1]).toBe("Dano em foe");
    expect(labels[2]).toContain("fora de combate");
  });

  it("posts the defender's roll as the defender in opposed systems", () => {
    const hero = token({ id: "hero", kind: "pc", stats: { defense: 30, armor: 0, speed: 6, initiative: 50, attacks: [{ id: "atk", name: "Briga", value: 50, damage: "1d3", range: 1 }] } });
    const foe = token({ id: "foe", kind: "enemy", stats: { defense: 30, armor: 0, speed: 6, initiative: 40, attacks: [] } });
    const outcome = attack(room([hero, foe], COC), hero, foe, { rng: scriptedRng(1, 3, 6, 3, 2) });
    const messages = applyEvents(room([hero, foe], COC), outcome.events, hero.id).messages;
    expect(messages[1]).toMatchObject({ author: { id: "foe" }, text: "Defesa de foe — Sucesso" });
  });

  it("uses the chosen attack", () => {
    const archer = token({
      id: "archer",
      kind: "pc",
      stats: {
        defense: 12,
        armor: 0,
        speed: 6,
        initiative: 0,
        attacks: [
          { id: "melee", name: "Adaga", value: 0, damage: "1d4", range: 1 },
          { id: "bow", name: "Arco", value: 5, damage: "1d6", range: 8 },
        ],
      },
    });
    const outcome = attack(room([archer]), archer, token({ id: "foe", kind: "enemy" }), { attackId: "bow", rng: scriptedRng(10, 3) });
    expect(outcome.events[0]).toMatchObject({ message: { text: expect.stringContaining("Arco") } });
  });
});

describe("rules", () => {
  it("re-derives NPC stats when the room switches system, keeping the wound proportion", () => {
    const { stats, hp } = adaptNpcStats(DEFAULT_RULES, skeleton);
    const foe = token({ id: "foe", kind: "enemy", npc: skeleton, stats, hp: { current: Math.round(hp / 2), max: hp } });
    const hero = token({ id: "hero", kind: "pc" });
    const after = applyEvents(room([hero, foe]), [{ type: "rules.set", rules: COC }], "system");
    const migrated = after.tokens.find((t) => t.id === "foe")!;
    expect(after.rules).toEqual(COC);
    expect(migrated.stats.defense).toBe(18);
    expect(migrated.hp).toEqual({ current: 4, max: 7 });
    // Player tokens follow their sheets, not the NPC table.
    expect(after.tokens.find((t) => t.id === "hero")!.stats).toEqual(hero.stats);
  });

  it("orders static initiative (no roll) by the score", () => {
    const a = token({ id: "a", kind: "pc", stats: { ...token({ id: "x", kind: "pc" }).stats, initiative: 40 } });
    const b = token({ id: "b", kind: "enemy", stats: { ...token({ id: "x", kind: "pc" }).stats, initiative: 70 } });
    const [started] = rollInitiative(room([a, b], COC));
    expect(started).toMatchObject({ type: "combat.started", order: [{ tokenId: "b", initiative: 70 }, { tokenId: "a", initiative: 40 }] });
  });

  it("takes the sheet's current HP when asked, keeping 'Caído' in step", () => {
    const hero = token({ id: "hero", kind: "pc", hp: { current: 10, max: 10 } });
    const down = applyEvents(room([hero]), [{ type: "token.synced", tokenId: "hero", stats: hero.stats, hpMax: 10, hpCurrent: 0 }], "system").tokens[0];
    expect(down.hp.current).toBe(0);
    expect(down.conditions).toContain("Caído");
    const up = applyEvents(room([down]), [{ type: "token.synced", tokenId: "hero", stats: hero.stats, hpMax: 10, hpCurrent: 25 }], "system").tokens[0];
    expect(up.hp.current).toBe(10);
    expect(up.conditions).not.toContain("Caído");
  });

  it("links a player token to its sheet", () => {
    const hero = token({ id: "hero", kind: "pc" });
    expect(applyEvents(room([hero]), [{ type: "token.linked", tokenId: "hero", characterId: "ch_1" }], "system").tokens[0].characterId).toBe("ch_1");
  });

  it("raises current HP with the max when a full-health token's sheet grows", () => {
    const hero = token({ id: "hero", kind: "pc", hp: { current: 10, max: 10 } });
    const after = applyEvents(room([hero]), [{ type: "token.synced", tokenId: "hero", stats: hero.stats, hpMax: 14 }], "system");
    expect(after.tokens[0].hp).toEqual({ current: 14, max: 14 });
  });
});

describe("migration", () => {
  it("turns the old single attack block into the new stats and keeps NPC blocks", () => {
    const legacy = {
      ...room([]),
      rules: undefined,
      tokens: [
        { ...token({ id: "foe", kind: "enemy", hp: { current: 13, max: 13 } }), stats: { defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2 } },
        { ...token({ id: "pc", kind: "pc", controller: "player" }), stats: { defense: 14, attackBonus: 5, damage: "1d8+3", speed: 6, initiativeBonus: 2 } },
      ],
    };
    const upgraded = upgradeRoom(legacy);
    expect(upgraded.rules).toEqual(DEFAULT_RULES);
    expect(upgraded.tokens[0]).toMatchObject({ npc: skeleton, stats: { defense: 13, initiative: 2, attacks: [{ value: 4, damage: "1d6+2" }] } });
    expect(upgraded.tokens[1].npc).toBeUndefined();
  });
});

describe("bots", () => {
  it("shoot from where they stand when the target is within reach", () => {
    const base = room([]);
    const at = freeCellNear(base.map, [], { x: 4, y: 11 });
    const foeCell = freeCellNear(base.map, [], { x: at.x + 4, y: at.y });
    const archer = token({ id: "kira", kind: "pc", controller: "bot", ...at, stats: { defense: 15, armor: 0, speed: 7, initiative: 4, attacks: [{ id: "bow", name: "Arco curto", value: 7, damage: "1d8+4", range: 6 }] } });
    const foe = token({ id: "foe", kind: "enemy", ...foeCell });
    const steps = decideTurn(room([archer, foe]), archer);
    const events = steps.flatMap((s) => s.events);
    expect(events.some((e) => e.type === "token.moved")).toBe(false);
    expect(events.some((e) => e.type === "message.posted" && e.message.text.startsWith("Ataque em foe"))).toBe(true);
  });
});
