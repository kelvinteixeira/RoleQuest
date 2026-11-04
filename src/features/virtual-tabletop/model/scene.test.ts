import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { cellIndex, createBlankMap, doorOf, isBlocked, resizeMap, trapOf, type MapDocument } from "@/features/map/model/map-document";
import { paintTerrain, placeProps, rectCells } from "@/features/map/model/shapes";
import { cryptMap } from "@/features/map/model/templates";
import { hasLineOfSight, visibleFrom } from "@/features/map/model/vision";
import { scriptedRng } from "@/test/rng";
import { decideTurn } from "./bots";
import { routeTo } from "./map";
import { applyEvents, armedTrapAt, createFog, partyVision, walk } from "./room-engine";
import { upgradeRoom } from "./room-migration";
import type { RoomState, RoomToken } from "./types";

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

function room(map: MapDocument, tokens: RoomToken[], fog = createFog()): RoomState {
  return { campaignId: "c1", rules: DEFAULT_RULES, map, tokens, messages: [], combat: { active: false, round: 0, turn: 0, order: [] }, fog, log: [], createdAt: "2026-01-01" };
}

/** 9×3 corridor between two walls of rock, with a door in the middle (x = 4). */
function corridor(): MapDocument {
  let m = createBlankMap(9, 3, "rock", "Corredor");
  m = paintTerrain(m, rectCells({ x: 0, y: 1 }, { x: 8, y: 1 }), "stone");
  return placeProps(m, [{ x: 4, y: 1 }], ["door"]);
}

const doorId = (m: MapDocument) => m.props.find((p) => p.propId === "door")!.id;

describe("doors", () => {
  it("start closed, face the passage and block movement and sight until opened", () => {
    const m = corridor();
    const door = m.props[0];
    expect(doorOf(door)).toEqual({ open: false, locked: false });
    expect(door.rotation).toBe(90);
    expect(isBlocked(m, 4, 1)).toBe(true);
    expect(hasLineOfSight(m, { x: 1, y: 1 }, { x: 7, y: 1 })).toBe(false);

    const opened = applyEvents(room(m, []), [{ type: "prop.updated", propId: door.id, door: { open: true } }], "gm").map;
    expect(isBlocked(opened, 4, 1)).toBe(false);
    expect(hasLineOfSight(opened, { x: 1, y: 1 }, { x: 7, y: 1 })).toBe(true);
  });

  it("gates block movement but not sight", () => {
    let m = createBlankMap(9, 3, "rock");
    m = paintTerrain(m, rectCells({ x: 0, y: 1 }, { x: 8, y: 1 }), "stone");
    m = placeProps(m, [{ x: 4, y: 1 }], ["gate"]);
    expect(isBlocked(m, 4, 1)).toBe(true);
    expect(hasLineOfSight(m, { x: 1, y: 1 }, { x: 7, y: 1 })).toBe(true);
  });

  it("are routed through only when open", () => {
    const m = corridor();
    const hero = token({ id: "hero", kind: "pc", x: 1, y: 1 });
    expect(routeTo(m, [hero], hero, { x: 7, y: 1 })).toBeNull();
    const opened = applyEvents(room(m, [hero]), [{ type: "prop.updated", propId: doorId(m), door: { open: true } }], "gm").map;
    expect(routeTo(opened, [hero], hero, { x: 7, y: 1 })).toHaveLength(6);
  });
});

describe("vision", () => {
  it("stops at walls but sees the wall itself", () => {
    const m = corridor();
    const seen = new Set(visibleFrom(m, { x: 1, y: 1 }, 8));
    expect(seen.has(cellIndex(m, 3, 1))).toBe(true);
    expect(seen.has(cellIndex(m, 4, 1))).toBe(true); // the closed door
    expect(seen.has(cellIndex(m, 5, 1))).toBe(false);
    expect(seen.has(cellIndex(m, 1, 0))).toBe(true); // rock wall beside the viewer
  });

  it("respects the radius", () => {
    const m = createBlankMap(20, 1, "grass");
    const seen = new Set(visibleFrom(m, { x: 0, y: 0 }, 5));
    expect(seen.has(5)).toBe(true);
    expect(seen.has(6)).toBe(false);
  });
});

describe("fog of war", () => {
  it("explores what the party sees once enabled, and keeps it after they move on", () => {
    const m = corridor();
    const hero = token({ id: "hero", kind: "pc", x: 1, y: 1 });
    let state = applyEvents(room(m, [hero]), [{ type: "fog.configured", enabled: true }], "gm");
    expect(state.fog.explored).toContain(cellIndex(m, 3, 1));
    expect(state.fog.explored).not.toContain(cellIndex(m, 6, 1));

    state = applyEvents(state, [{ type: "prop.updated", propId: m.props[0].id, door: { open: true } }, { type: "token.moved", tokenId: "hero", x: 7, y: 1 }], "gm");
    expect(state.fog.explored).toContain(cellIndex(m, 6, 1));
    // Still explored, no longer in sight once the door is shut behind them.
    state = applyEvents(state, [{ type: "prop.updated", propId: m.props[0].id, door: { open: false } }], "gm");
    expect(partyVision(state).has(cellIndex(m, 1, 1))).toBe(false);
    expect(state.fog.explored).toContain(cellIndex(m, 1, 1));
  });

  it("only player characters still standing see; enemies don't explore", () => {
    const m = createBlankMap(30, 1, "grass");
    const foe = token({ id: "foe", kind: "enemy", x: 25 });
    const downed = token({ id: "down", kind: "pc", x: 0, hp: { current: 0, max: 10 } });
    const state = applyEvents(room(m, [foe, downed]), [{ type: "fog.configured", enabled: true, vision: 3 }], "gm");
    expect(state.fog.explored).toEqual([]);
  });

  it("GM reveal and hide, clamped to the map", () => {
    const m = createBlankMap(4, 4, "grass");
    let state = applyEvents(room(m, []), [{ type: "fog.configured", enabled: true }, { type: "fog.revealed", cells: [0, 1, 2, 99, -1] }], "gm");
    expect(state.fog.explored).toEqual([0, 1, 2]);
    state = applyEvents(state, [{ type: "fog.hidden", cells: [1] }], "gm");
    expect(state.fog.explored).toEqual([0, 2]);
    // Big cell lists stay out of the event log.
    const all = applyEvents(state, [{ type: "fog.revealed", cells: Array.from({ length: 40 }, (_, i) => i) }], "gm");
    expect(all.fog.explored).toHaveLength(16);
    expect(all.log.at(-1)!.event).toEqual({ type: "fog.revealed", cells: [] });
  });

  it("forgets the explored area when a different map is applied, keeps it for the same map", () => {
    const m = createBlankMap(4, 4, "grass");
    const state = applyEvents(room(m, []), [{ type: "fog.revealed", cells: [0, 1] }], "gm");
    expect(applyEvents(state, [{ type: "map.replaced", map: { ...m, name: "Editado" } }], "gm").fog.explored).toEqual([0, 1]);
    expect(applyEvents(state, [{ type: "map.replaced", map: createBlankMap(4, 4) }], "gm").fog.explored).toEqual([]);
  });

  it("explores along the route a player character walked, not only where it stopped", () => {
    // A 1-wide corridor with a side room at x = 6..8 above it; vision 1 sees only neighbours.
    let m = createBlankMap(16, 6, "rock");
    m = paintTerrain(m, rectCells({ x: 0, y: 4 }, { x: 15, y: 4 }), "stone");
    m = paintTerrain(m, rectCells({ x: 6, y: 1 }, { x: 8, y: 3 }), "stone");
    const hero = token({ id: "hero", kind: "pc", x: 0, y: 4 });
    const state = applyEvents(room(m, [hero], { enabled: true, vision: 1, explored: [] }), [], "gm");
    const path = routeTo(m, [hero], hero, { x: 15, y: 4 })!;
    const after = applyEvents(state, walk(state, hero, path).events, "gm");
    expect(after.fog.explored).toContain(cellIndex(m, 7, 3));

    const enemy = token({ id: "foe", kind: "enemy", x: 0, y: 4 });
    const s2 = room(m, [enemy], { enabled: true, vision: 1, explored: [] });
    const moved = applyEvents(s2, walk(s2, enemy, path).events, "gm");
    expect(moved.fog.explored).toEqual([]);
  });

  it("keeps the explored area through a resize of the same map", () => {
    const m = createBlankMap(4, 4, "grass");
    const state = applyEvents(room(m, []), [{ type: "fog.revealed", cells: [cellIndex(m, 1, 1), cellIndex(m, 3, 3)] }], "gm");
    const bigger = applyEvents(state, [{ type: "map.replaced", map: resizeMap(m, 6, 3) }], "gm");
    expect(bigger.fog.explored).toEqual([1 * 6 + 1]);
  });

  it("is added, off, to rooms saved before it existed", () => {
    const { fog, ...legacy } = room(createBlankMap(4, 4), []);
    expect(fog).toBeDefined();
    expect(upgradeRoom(legacy as Parameters<typeof upgradeRoom>[0]).fog).toEqual(createFog());
  });
});

describe("traps", () => {
  function trapped(): MapDocument {
    const m = createBlankMap(8, 1, "grass");
    return placeProps(m, [{ x: 3, y: 0 }], ["trap-spikes"]);
  }

  it("start hidden and armed with the default damage", () => {
    expect(trapOf(trapped().props[0])).toEqual({ hidden: true, armed: true, damage: "2d6" });
  });

  it("stop the walk on their square, go off once, and hurt", () => {
    const m = trapped();
    const hero = token({ id: "hero", kind: "pc", x: 0, hp: { current: 10, max: 10 } });
    const path = routeTo(m, [hero], hero, { x: 6, y: 0 })!;
    const result = walk({ map: m }, hero, path, scriptedRng(4, 3));
    expect(result).toMatchObject({ trapped: true, end: { x: 3, y: 0 } });

    const after = applyEvents(room(m, [hero]), result.events, "gm");
    const h = after.tokens[0];
    expect([h.x, h.y, h.hp.current]).toEqual([3, 0, 3]);
    expect(trapOf(after.map.props[0])).toMatchObject({ armed: false, hidden: false });
    expect(armedTrapAt(after.map, { x: 3, y: 0 })).toBeUndefined();
    expect(after.messages.map((m) => m.text)).toEqual(["hero ativou: armadilha de espinhos!", "Armadilha de espinhos em hero"]);

    // Disarmed now: walking over it again is just a walk.
    const again = walk(after, { ...h, x: 2 }, [{ x: 3, y: 0 }, { x: 4, y: 0 }]);
    expect(again).toMatchObject({ trapped: false, end: { x: 4, y: 0 } });
  });

  it("announce a fall", () => {
    const m = trapped();
    const hero = token({ id: "hero", kind: "pc", x: 2, hp: { current: 4, max: 10 } });
    const { events } = walk({ map: m }, hero, [{ x: 3, y: 0 }], scriptedRng(6, 6));
    expect(events.at(-1)).toMatchObject({ type: "message.posted", message: { text: "hero caiu!" } });
  });

  it("catch bots on their way to a target", () => {
    const m = trapped();
    const bot = token({ id: "bot", kind: "pc", controller: "bot", x: 0, hp: { current: 30, max: 30 } });
    const foe = token({ id: "foe", kind: "enemy", x: 7 });
    const steps = decideTurn(room(m, [bot, foe]), bot);
    const moved = steps[0].events.find((e) => e.type === "token.moved");
    expect(moved).toMatchObject({ x: 3, y: 0 });
    expect(steps[0].events.some((e) => e.type === "prop.updated")).toBe(true);
  });
});

describe("crypt template", () => {
  it("has doors facing their corridors, a locked gate and two hidden traps", () => {
    const m = cryptMap();
    const doors = m.props.filter((p) => p.propId === "door");
    expect(doors.map((d) => [d.x, d.y, d.rotation])).toEqual([
      [10, 11, 90],
      [17, 17, 0],
    ]);
    expect(doorOf(m.props.find((p) => p.propId === "gate")!)).toEqual({ open: false, locked: true });
    expect(m.props.filter((p) => trapOf(p)?.hidden && trapOf(p)?.armed)).toHaveLength(2);
  });
});
