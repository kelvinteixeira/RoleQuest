import { describe, expect, it } from "vitest";
import { createBlankMap, type MapDocument } from "@/features/map/model/map-document";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import type { PlayerPolicy } from "@/types/campaign";
import { applyEvents, createFog, say, whisper, rollEvent } from "../model/room-engine";
import type { RoomState, RoomToken } from "../model/types";
import { GM_RECIPIENT, parseIntent, resolveIntent, type IntentActor } from "./intents";
import { playerMapOf, roomFromView, viewFor, type Viewer } from "./views";

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

function map(): MapDocument {
  const doc = createBlankMap(20, 12, "grass", "Teste");
  return {
    ...doc,
    notes: [{ id: "n1", x: 1, y: 1, text: "o tesouro está no poço" }],
    props: [
      { id: "trap-hidden", propId: "trap-spikes", x: 5, y: 5, rotation: 0, trap: { hidden: true, armed: true, damage: "1d6" } },
      { id: "trap-seen", propId: "trap-darts", x: 6, y: 5, rotation: 0, trap: { hidden: false, armed: true, damage: "1d4" } },
      { id: "door", propId: "door", x: 3, y: 2, rotation: 0, door: { open: false, locked: false } },
    ],
  };
}

const hero = token({ id: "hero", kind: "pc", controller: "player", characterId: "ch-ana", x: 2, y: 2 });
const friend = token({ id: "friend", kind: "pc", controller: "player", characterId: "ch-bia", x: 2, y: 3 });
const nearFoe = token({ id: "near", kind: "enemy", x: 3, y: 3, npc: { hp: 10, defense: 12, attackBonus: 3, damage: "1d6", speed: 6, initiativeBonus: 1 } });
const farFoe = token({ id: "far", kind: "enemy", x: 18, y: 10 });

function room(partial: Partial<RoomState> = {}): RoomState {
  return {
    campaignId: "c1",
    rules: DEFAULT_RULES,
    map: map(),
    tokens: [hero, friend, nearFoe, farFoe],
    messages: [],
    combat: { active: false, round: 0, turn: 0, order: [] },
    fog: { ...createFog(), enabled: true, vision: 4 }, audio: { music: null, ambience: [] },
    log: [],
    createdAt: "2026-11-06",
    ...partial,
  };
}

const ana: Viewer = { userId: "u-ana", role: "player", tokenIds: ["hero"] };
const gmViewer: Viewer = { userId: "u-gm", role: "game_master", tokenIds: [] };
const POLICY: PlayerPolicy = { maxPlayers: 4, playersCanEditSheets: true, playersCanMoveOwnToken: true, allowPrivateMessages: true, rollsPublicByDefault: true };
const anaActor: IntentActor = { userId: "u-ana", role: "player", author: { id: "u-ana", name: "Isolde", color: "red" }, tokenIds: ["hero"], policy: POLICY };
const gmActor: IntentActor = { ...anaActor, userId: "u-gm", role: "game_master", tokenIds: [] };

describe("what a player receives", () => {
  it("the map without GM notes and hidden traps", () => {
    const shown = playerMapOf(map());
    expect(shown.notes).toBeUndefined();
    expect(shown.props.map((p) => p.id)).toEqual(["trap-seen", "door"]);
  });

  it("the party, and only the enemies the party sees right now (stat blocks stay with the GM)", () => {
    const view = viewFor(room(), ana, { revision: 1, mapRevision: 1 });
    const ids = view.room.tokens.map((t) => t.id);
    expect(ids).toEqual(["hero", "friend", "near"]);
    expect(view.room.tokens.find((t) => t.id === "near")).not.toHaveProperty("npc");
    expect(view.room.map).toBeUndefined();
    // Without fog, everything on the map is in sight.
    expect(viewFor(room({ fog: { ...createFog(), enabled: false } }), ana, { revision: 1, mapRevision: 1 }).room.tokens).toHaveLength(4);
  });

  it("public messages, their own whispers and secret rolls; not other people's", () => {
    let state = room();
    state = applyEvents(
      state,
      [
        say({ id: "u-gm", name: "Mestre", color: "#fff" }, "Bem-vindos"),
        whisper({ id: "u-gm", name: "Mestre", color: "#fff" }, { id: "friend", name: "Bia" }, "segredo da Bia"),
        whisper({ id: "u-ana", name: "Isolde", color: "red" }, GM_RECIPIENT, "pergunta da Ana"),
        rollEvent({ id: "u-gm", name: "Mestre", color: "#fff" }, "1d20", { visibility: "gm" }).event,
        rollEvent({ id: "u-ana", name: "Isolde", color: "red" }, "1d20", { visibility: "gm" }).event,
      ],
      "u-gm",
    );
    const texts = viewFor(state, ana, { revision: 1, mapRevision: 1 }).room.messages.map((m) => m.text);
    expect(texts).toEqual(["Bem-vindos", "pergunta da Ana", "1d20"]);
    expect(viewFor(state, gmViewer, { revision: 1, mapRevision: 1 }).room.messages).toHaveLength(5);
  });

  it("the turn order keeps its length, but creatures out of sight are anonymous; their numbers never travel", () => {
    const state = room({ combat: { active: true, round: 1, turn: 1, order: [{ tokenId: "far", initiative: 20 }, { tokenId: "hero", initiative: 12 }, { tokenId: "near", initiative: 5 }] } });
    const view = viewFor(state, ana, { revision: 1, mapRevision: 1 });
    expect(view.room.combat.order.map((o) => o.tokenId)).toEqual(["oculto-0", "hero", "near"]);
    expect(view.room.combat.turn).toBe(1);
    expect(view.room.tokens.find((t) => t.id === "near")!.stats.attacks).toEqual([]);
    expect(view.room.tokens.find((t) => t.id === "hero")!.stats.attacks).toHaveLength(1);
  });

  it("recent events for animations: never fog painting, map swaps or what happens out of sight", () => {
    const state = applyEvents(
      room(),
      [
        { type: "fog.revealed", cells: [1, 2, 3] },
        { type: "token.moved", tokenId: "far", x: 17, y: 10 },
        { type: "token.moved", tokenId: "near", x: 4, y: 3 },
        { type: "token.hp", tokenId: "hero", delta: -3 },
      ],
      "u-gm",
    );
    const recent = viewFor(state, ana, { revision: 1, mapRevision: 1 }).recent.map((e) => e.event.type);
    expect(recent).toEqual(["token.moved", "token.hp"]);
  });

  it("rebuilds a renderable room from the view and the shared map", () => {
    const view = viewFor(room(), ana, { revision: 3, mapRevision: 2 });
    expect(roomFromView(view, null)).toBeNull();
    const rebuilt = roomFromView(view, playerMapOf(map()))!;
    expect(rebuilt.log).toEqual([]);
    expect(rebuilt.map.props).toHaveLength(2);
    // GMs get the map inside their view.
    expect(roomFromView(viewFor(room(), gmViewer, { revision: 1, mapRevision: 1 }), null)!.map.notes).toHaveLength(1);
  });
});

describe("what a player may ask the host", () => {
  it("moves only their own token, when the table allows, on their turn in combat", () => {
    const ok = resolveIntent(room(), { kind: "move", tokenId: "hero", x: 2, y: 5 }, anaActor);
    expect(ok.ok && ok.events[0]).toMatchObject({ type: "token.moved", tokenId: "hero", x: 2, y: 5 });
    expect(resolveIntent(room(), { kind: "move", tokenId: "friend", x: 2, y: 5 }, anaActor)).toEqual({ ok: false, error: "Você só age com o seu personagem." });
    expect(resolveIntent(room(), { kind: "move", tokenId: "hero", x: 2, y: 5 }, { ...anaActor, policy: { ...POLICY, playersCanMoveOwnToken: false } }).ok).toBe(false);
    const combat = room({ combat: { active: true, round: 1, turn: 0, order: [{ tokenId: "near", initiative: 18 }, { tokenId: "hero", initiative: 10 }] } });
    expect(resolveIntent(combat, { kind: "move", tokenId: "hero", x: 2, y: 5 }, anaActor)).toEqual({ ok: false, error: "Espere a sua vez no combate." });
    // The GM moves anyone, any time.
    expect(resolveIntent(combat, { kind: "move", tokenId: "far", x: 17, y: 9 }, gmActor).ok).toBe(true);
  });

  it("walks the route, so a hidden trap (that the player could not see) still goes off", () => {
    const r = resolveIntent(room(), { kind: "move", tokenId: "hero", x: 5, y: 5 }, anaActor);
    expect(r.ok).toBe(true);
    const types = r.ok ? r.events.map((e) => e.type) : [];
    expect(types.slice(0, 2)).toEqual(["token.moved", "prop.updated"]);
    expect(types).toContain("token.hp");
  });

  it("chat and whispers to the GM (when private messages are on)", () => {
    const r = resolveIntent(room(), { kind: "chat", text: "  oi mestre ", toGm: true }, anaActor);
    expect(r.ok && r.events[0]).toMatchObject({ type: "message.posted", message: { kind: "whisper", visibility: "gm", to: GM_RECIPIENT, text: "oi mestre" } });
    expect(resolveIntent(room(), { kind: "chat", text: "oi", toGm: true }, { ...anaActor, policy: { ...POLICY, allowPrivateMessages: false } }).ok).toBe(false);
    expect(resolveIntent(room(), { kind: "chat", text: "   " }, anaActor).ok).toBe(false);
  });

  it("dice are rolled by the host; secret rolls go to the GM; bad formulas are refused", () => {
    const r = resolveIntent(room(), { kind: "roll", formula: "2d6+1", secret: true }, anaActor);
    expect(r.ok && r.events[0]).toMatchObject({ type: "message.posted", message: { kind: "roll", visibility: "gm", author: { id: "u-ana" } } });
    expect(resolveIntent(room(), { kind: "roll", formula: "banana" }, anaActor).ok).toBe(false);
  });

  it("attacks with their own token, only on what is in reach", () => {
    expect(resolveIntent(room(), { kind: "attack", attackerId: "hero", targetId: "near" }, anaActor).ok).toBe(true);
    // Out of sight: same answer as a target that doesn't exist (nothing to learn from it).
    expect(resolveIntent(room(), { kind: "attack", attackerId: "hero", targetId: "far" }, anaActor)).toEqual({ ok: false, error: "Alvo inválido." });
    expect(resolveIntent(room({ fog: { ...createFog(), enabled: false } }), { kind: "attack", attackerId: "hero", targetId: "far" }, anaActor)).toEqual({ ok: false, error: "far está fora de alcance." });
    expect(resolveIntent(room(), { kind: "attack", attackerId: "hero", targetId: "friend" }, anaActor)).toEqual({ ok: false, error: "Alvo inválido." });
    expect(resolveIntent(room(), { kind: "attack", attackerId: "near", targetId: "hero" }, anaActor).ok).toBe(false);
  });

  it("doors open from next to them, unless locked", () => {
    expect(resolveIntent(room(), { kind: "door", propId: "door" }, anaActor).ok).toBe(true);
    const away = room({ tokens: [{ ...hero, x: 10, y: 10 }, friend, nearFoe, farFoe] });
    expect(resolveIntent(away, { kind: "door", propId: "door" }, anaActor)).toEqual({ ok: false, error: "Chegue perto da porta para abri-la." });
    const locked = room({ map: { ...map(), props: map().props.map((p) => (p.id === "door" ? { ...p, door: { open: false, locked: true } } : p)) } });
    expect(resolveIntent(locked, { kind: "door", propId: "door" }, anaActor).ok).toBe(false);
  });

  it("in combat a player gets one attack and their speed in squares per turn", () => {
    const combat = room({ combat: { active: true, round: 1, turn: 0, order: [{ tokenId: "hero", initiative: 18 }, { tokenId: "near", initiative: 9 }] } });
    expect(resolveIntent(combat, { kind: "attack", attackerId: "hero", targetId: "near" }, anaActor, { moved: 0, attacked: true })).toEqual({ ok: false, error: "Você já atacou neste turno." });
    const first = resolveIntent(combat, { kind: "attack", attackerId: "hero", targetId: "near" }, anaActor);
    expect(first.ok && first.spent).toEqual({ attacked: true });
    // Speed 6: 3 squares walked leaves 3.
    expect(resolveIntent(combat, { kind: "move", tokenId: "hero", x: 2, y: 8 }, anaActor, { moved: 3, attacked: false })).toEqual({ ok: false, error: "Neste turno você ainda anda 3 □." });
    const walked = resolveIntent(combat, { kind: "move", tokenId: "hero", x: 2, y: 5 }, anaActor, { moved: 3, attacked: false });
    expect(walked.ok && walked.spent).toEqual({ moved: 3 });
    // Out of combat there is no budget.
    expect(resolveIntent(room(), { kind: "move", tokenId: "hero", x: 2, y: 10 }, anaActor, { moved: 99, attacked: true }).ok).toBe(true);
  });

  it("destinations outside the map are refused before any path search", () => {
    expect(resolveIntent(room(), { kind: "move", tokenId: "hero", x: 2147483647, y: 2 }, anaActor)).toEqual({ ok: false, error: "Destino inválido." });
    expect(resolveIntent(room(), { kind: "move", tokenId: "hero", x: -1, y: 2 }, anaActor)).toEqual({ ok: false, error: "Destino inválido." });
    expect(parseIntent({ kind: "move", tokenId: "hero", x: 1e300, y: 1 })).toBeNull();
    expect(parseIntent({ kind: "roll", formula: "1d20", mode: "cheat" })).toBeNull();
    expect(parseIntent({ kind: "chat", text: "oi", toGm: "sim" })).toBeNull();
  });

  it("doors in combat only on your turn", () => {
    const combat = room({ combat: { active: true, round: 1, turn: 0, order: [{ tokenId: "near", initiative: 18 }, { tokenId: "hero", initiative: 9 }] } });
    expect(resolveIntent(combat, { kind: "door", propId: "door" }, anaActor)).toEqual({ ok: false, error: "Espere a sua vez no combate." });
  });

  it("raw events only from GMs; malformed intents are dropped", () => {
    const events = [{ type: "token.hp" as const, tokenId: "far", delta: -99 }];
    expect(resolveIntent(room(), { kind: "events", events }, anaActor).ok).toBe(false);
    expect(resolveIntent(room(), { kind: "events", events, actorId: "near" }, gmActor)).toEqual({ ok: true, events, actorId: "near" });
    expect(parseIntent({ kind: "move", tokenId: "hero" })).toBeNull();
    expect(parseIntent({ kind: "hack" })).toBeNull();
    expect(parseIntent("move")).toBeNull();
    expect(parseIntent({ kind: "chat", text: "oi" })).toEqual({ kind: "chat", text: "oi" });
  });
});
