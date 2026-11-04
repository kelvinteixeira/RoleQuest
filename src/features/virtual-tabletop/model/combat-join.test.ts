import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import { createBlankMap } from "@/features/map/model/map-document";
import { currentSessionOf } from "@/services/campaign.service";
import type { GameSession } from "@/types/campaign";
import { scriptedRng } from "@/test/rng";
import { applyEvents, createFog, joinCombat } from "./room-engine";
import type { RoomState, RoomToken } from "./types";

const token = (id: string, kind: RoomToken["kind"]): RoomToken => ({
  id,
  kind,
  controller: "gm",
  name: id,
  ownerName: "Mestre",
  concept: "",
  color: "#888",
  x: 0,
  y: 0,
  hp: { current: 10, max: 10 },
  stats: { defense: 12, armor: 0, speed: 6, initiative: 0, attacks: [] },
  conditions: [],
});

describe("reinforcements", () => {
  it("join a running combat by initiative; whoever is acting keeps the turn", () => {
    const base: RoomState = {
      campaignId: "c1",
      rules: DEFAULT_RULES,
      map: createBlankMap(8, 8),
      tokens: [token("hero", "pc"), token("foe", "enemy")],
      messages: [],
      combat: { active: true, round: 2, turn: 1, order: [{ tokenId: "hero", initiative: 15 }, { tokenId: "foe", initiative: 8 }] },
      fog: createFog(),
      log: [],
      createdAt: "",
    };
    const late = token("late", "enemy");
    const state = applyEvents(base, [{ type: "token.added", token: late }, ...joinCombat(base, [late], scriptedRng(18))], "gm");
    expect(state.combat.order.map((o) => o.tokenId)).toEqual(["late", "hero", "foe"]);
    expect(state.combat.order[state.combat.turn].tokenId).toBe("foe");
    expect(state.messages.at(-1)!.text).toBe("Entram no combate: late 18");
    // Outside combat the event changes nothing.
    expect(applyEvents({ ...base, combat: { active: false, round: 0, turn: 0, order: [] } }, joinCombat(base, [late], scriptedRng(5)), "gm").combat.order).toEqual([]);
  });
});

describe("current session", () => {
  const session = (id: string, status: GameSession["status"], scheduledAt: string): GameSession => ({ id, campaignId: "c1", number: 1, title: id, status, scheduledAt, durationMinutes: 180, summary: "", highlights: [], attendeeIds: [], createdAt: "", updatedAt: "" });
  const now = new Date("2026-11-04T22:30:00Z").getTime();

  it("is the one under way: live, or started in the last 12 hours", () => {
    expect(currentSessionOf([session("s7", "scheduled", "2026-11-04T20:00:00Z"), session("s8", "scheduled", "2026-11-11T20:00:00Z")], now)?.id).toBe("s7");
    expect(currentSessionOf([session("old", "scheduled", "2026-11-03T08:00:00Z")], now)).toBeNull();
    expect(currentSessionOf([session("s7", "live", "2026-11-04T10:00:00Z")], now)?.id).toBe("s7");
  });
});
