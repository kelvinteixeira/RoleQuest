import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/features/map/model/map-document";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { createFog } from "../model/room-engine";
import type { RoomState, RoomToken } from "../model/types";
import { useRoomStore } from "./room.store";

const hero: RoomToken = {
  id: "hero",
  kind: "pc",
  controller: "gm",
  name: "Kira",
  ownerName: "Mestre",
  concept: "",
  color: "#888",
  x: 1,
  y: 1,
  hp: { current: 10, max: 10 },
  stats: { defense: 12, armor: 0, speed: 6, initiative: 0, attacks: [] },
  conditions: [],
};

const room = (): RoomState => ({
  campaignId: "c1",
  rules: DEFAULT_RULES,
  map: createBlankMap(),
  tokens: [hero],
  messages: [],
  combat: { active: false, round: 0, turn: 0, order: [] },
  fog: createFog(),
  audio: { music: null, ambience: [] },
  log: [],
  createdAt: "2026-01-01",
});

describe("room store moves", () => {
  it("puts the new square and the route to it in the same update", () => {
    useRoomStore.setState({ rooms: { c1: room() }, routes: {} });
    const updates: { x: number; route: boolean }[] = [];
    const stop = useRoomStore.subscribe((s) => updates.push({ x: s.rooms.c1.tokens[0].x, route: !!s.routes.hero }));
    const path = [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ];
    useRoomStore.getState().dispatch("c1", "gm", [{ type: "token.moved", tokenId: "hero", x: 4, y: 1, path }]);
    stop();
    // Never a state where the token stands on its new square without the route that leads there.
    const first = updates.find((u) => u.x === 4);
    expect(first).toEqual({ x: 4, route: true });
    expect(useRoomStore.getState().routes.hero.cells).toEqual(path);
  });
});
