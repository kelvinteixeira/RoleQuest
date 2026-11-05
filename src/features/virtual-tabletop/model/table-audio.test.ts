import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/features/map/model/map-document";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { applyEvents, createFog, silentAudio } from "./room-engine";
import { upgradeRoom, type StoredRoom } from "./room-migration";
import type { RoomState } from "./types";
import { viewFor } from "../sync/views";

const room = (): RoomState => ({
  campaignId: "c1",
  rules: DEFAULT_RULES,
  map: { ...createBlankMap(6, 4), background: { imageId: "img_local", width: 600, height: 400, cols: 6, offsetX: 0, offsetY: 0, opacity: 1 } } as RoomState["map"],
  tokens: [],
  messages: [],
  combat: { active: false, round: 0, turn: 0, order: [] },
  fog: createFog(),
  audio: silentAudio(),
  log: [],
  createdAt: "2026-11-08",
});

describe("the table's sound", () => {
  it("music and ambience are room state: everyone (players too) gets them in their view", () => {
    const cue = { id: "q1", source: "theme" as const, ref: "combat", title: "Combate", startedAt: "2026-11-08T20:00:00Z", volume: 0.8, loop: true };
    const state = applyEvents(room(), [{ type: "audio.music", music: cue }, { type: "audio.ambience", ambience: [{ id: "rain", volume: 0.5 }] }], "gm");
    expect(state.audio).toEqual({ music: cue, ambience: [{ id: "rain", volume: 0.5 }] });
    const view = viewFor(state, { userId: "ana", role: "player", tokenIds: [] }, { revision: 1, mapRevision: 1 });
    expect(view.room.audio).toEqual(state.audio);
    expect(applyEvents(state, [{ type: "audio.music", music: null }], "gm").audio.music).toBeNull();
  });

  it("ambience layers change one at a time, so two GMs mixing don't undo each other", () => {
    let state = applyEvents(room(), [{ type: "audio.layer", id: "rain", volume: 0.5 }], "gm");
    // Another GM adds fire from a view that didn't have rain yet: rain stays.
    state = applyEvents(state, [{ type: "audio.layer", id: "fire", volume: 0.6 }], "gm2");
    expect(state.audio.ambience).toEqual([{ id: "rain", volume: 0.5 }, { id: "fire", volume: 0.6 }]);
    // A new level keeps the layer's place; null takes it off.
    state = applyEvents(state, [{ type: "audio.layer", id: "rain", volume: 0.2 }], "gm");
    expect(state.audio.ambience).toEqual([{ id: "rain", volume: 0.2 }, { id: "fire", volume: 0.6 }]);
    state = applyEvents(state, [{ type: "audio.layer", id: "rain", volume: null }], "gm2");
    expect(state.audio.ambience).toEqual([{ id: "fire", volume: 0.6 }]);
  });

  it("a map picture can move (to shared storage) without touching the rest of the map", () => {
    const before = room();
    const after = applyEvents(before, [{ type: "map.image", imageId: "c1/abc.webp" }], "system");
    expect(after.map.background?.imageId).toBe("c1/abc.webp");
    expect({ ...after.map, background: undefined }).toEqual({ ...before.map, background: undefined });
  });

  it("a room saved without audio still takes music and ambience (state comes out complete)", () => {
    const { audio: _audio, ...old } = room();
    void _audio;
    const next = applyEvents(old as RoomState, [{ type: "audio.music", music: null }], "gm");
    expect(next.audio).toEqual({ music: null, ambience: [] });
  });

  it("rooms saved before the audio centre start silent", () => {
    const { audio: _audio, ...old } = room();
    void _audio;
    expect(upgradeRoom(old as StoredRoom).audio).toEqual(silentAudio());
  });
});
