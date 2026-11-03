import { createId } from "@/lib/id";
import type { CampaignOverview } from "@/services/campaign.service";
import { createEncounterTokens } from "./bots";
import { createStarterMap, PLAYER_SPAWNS } from "./map";
import { announce, applyEvents } from "./room-engine";
import type { RoomState, RoomToken } from "./types";

/**
 * Builds a fresh room for a campaign: starter map, a test encounter and a
 * token for every player whose character is linked to the campaign.
 */
export function createInitialRoom(overview: CampaignOverview): RoomState {
  const players: RoomToken[] = overview.members
    .filter((m) => m.role === "player" && m.character)
    .map((m, i) => {
      const character = m.character!;
      const hp = character.resources[0];
      const spawn = PLAYER_SPAWNS[i % PLAYER_SPAWNS.length];
      return {
        id: createId("tok"),
        kind: "pc",
        controller: "player",
        name: character.name,
        ownerName: m.profile.displayName,
        concept: character.concept,
        color: character.portraitColor,
        x: spawn.x,
        y: spawn.y,
        hp: { current: hp?.current ?? 20, max: hp?.max ?? 20 },
        stats: { defense: 14, attackBonus: 5, damage: "1d8+3", speed: 6, initiativeBonus: 2 },
        conditions: [],
      };
    });

  const base: RoomState = {
    campaignId: overview.campaign.id,
    map: createStarterMap(),
    tokens: [...players, ...createEncounterTokens()],
    messages: [],
    combat: { active: false, round: 0, turn: 0, order: [] },
    log: [],
    createdAt: new Date().toISOString(),
  };
  const next = overview.upcomingSessions[0];
  return applyEvents(base, [announce(next ? `Sessão ${next.number}: ${next.title}. A mesa está aberta.` : "A mesa está aberta.")], "system");
}
