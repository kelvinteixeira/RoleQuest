import { createId } from "@/lib/id";
import type { CampaignOverview } from "@/services/campaign.service";
import { ensureSheet } from "@/features/character-sheet/model/sheet";
import { combatProfile, sheetHitPoints } from "@/features/combat/model/profile";
import { rulesFor } from "@/features/combat/model/rules";
import { createEncounterTokens } from "./bots";
import { riverGladeMap } from "@/features/map/model/templates";
import { defaultModelId } from "./character-models";
import { freeCellNear, PLAYER_SPAWNS } from "./map";
import { announce, applyEvents, createFog } from "./room-engine";
import type { RoomState, RoomToken } from "./types";

/**
 * Builds a fresh room for a campaign: starter map, the system's combat rules,
 * a test encounter and a token (stats from the sheet) for every player whose
 * character is linked to the campaign.
 */
export function createInitialRoom(overview: CampaignOverview): RoomState {
  const map = riverGladeMap();
  const { system } = overview;
  const rules = rulesFor(system);
  const placed: RoomToken[] = [];
  const players: RoomToken[] = overview.members
    .filter((m) => m.role === "player" && m.character)
    .map((m, i) => {
      const character = m.character!;
      const sheet = ensureSheet(character, system);
      const hp = sheetHitPoints(system, sheet) ?? { current: 20, max: 20 };
      const spawn = freeCellNear(map, placed, PLAYER_SPAWNS[i % PLAYER_SPAWNS.length]);
      const token: RoomToken = {
        id: createId("tok"),
        kind: "pc",
        controller: "player",
        name: character.name,
        ownerName: m.profile.displayName,
        concept: character.concept,
        characterId: character.id,
        modelId: defaultModelId({ kind: "pc", concept: character.concept, name: character.name }),
        color: character.portraitColor,
        x: spawn.x,
        y: spawn.y,
        hp,
        stats: combatProfile(system, sheet, character.level),
        conditions: [],
      };
      placed.push(token);
      return token;
    });

  const base: RoomState = {
    campaignId: overview.campaign.id,
    rules,
    map,
    tokens: [...players, ...createEncounterTokens(map, rules, players)],
    messages: [],
    combat: { active: false, round: 0, turn: 0, order: [] },
    fog: createFog(),
    log: [],
    createdAt: new Date().toISOString(),
  };
  const next = overview.upcomingSessions[0];
  return applyEvents(base, [announce(next ? `Sessão ${next.number}: ${next.title}. A mesa está aberta.` : "A mesa está aberta.")], "system");
}
