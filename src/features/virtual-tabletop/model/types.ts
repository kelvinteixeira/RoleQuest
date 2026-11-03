import type { RollResult } from "@/features/dice/dice-engine";
import type { MapDocument } from "@/features/map/model/map-document";
import type { CombatRules, CombatStats, NpcStatBlock } from "@/features/combat/model/types";

export type TokenKind = "pc" | "npc" | "enemy";
/** Who drives the token: the GM, a (future) human player, or a local test bot. */
export type TokenController = "gm" | "player" | "bot";

export type { CombatStats } from "@/features/combat/model/types";

export interface RoomToken {
  id: string;
  kind: TokenKind;
  controller: TokenController;
  name: string;
  /** Who plays it ("Mestre", "Bot · Ana", a player's name). */
  ownerName: string;
  concept: string;
  color: string;
  x: number;
  y: number;
  hp: { current: number; max: number };
  stats: CombatStats;
  conditions: string[];
  /** Personality key for bots (lines, tactics). */
  botId?: string;
  /** 3D model (see character-models.ts); falls back to a guess from the concept. */
  modelId?: string;
  /** Linked character sheet (player characters); its combat block feeds `stats`. */
  characterId?: string;
  /** Enemies and bots: stat block in d20 terms, re-derived for the room's system. */
  npc?: NpcStatBlock;
}

/** The room plays on a square-tile map document (terrain, elevation, props). */
export type RoomMap = MapDocument;

export interface Author {
  id: string;
  name: string;
  color: string;
}

export type MessageVisibility = "public" | "gm";

export interface ChatMessage {
  id: string;
  at: string;
  kind: "chat" | "roll" | "system" | "whisper" | "epic";
  author: Author;
  text: string;
  roll?: RollResult & { label?: string };
  /** Token this action targets (attacks, heals) — lets the 3D model face it. */
  targetId?: string;
  visibility: MessageVisibility;
  to?: { id: string; name: string };
}

export interface CombatState {
  active: boolean;
  round: number;
  /** Index into `order`. */
  turn: number;
  order: { tokenId: string; initiative: number }[];
}

/**
 * Everything that changes in a room is an event. The same events will be
 * broadcast over Supabase Realtime (Phase 4) and feed Chronicles Studio (Phase 6).
 */
export type RoomEvent =
  | { type: "token.added"; token: RoomToken }
  | { type: "token.removed"; tokenId: string }
  | { type: "token.moved"; tokenId: string; x: number; y: number }
  | { type: "token.hp"; tokenId: string; delta: number }
  | { type: "token.condition"; tokenId: string; condition: string; on: boolean }
  | { type: "token.stats"; tokenId: string; stats: Partial<CombatStats> }
  | { type: "token.appearance"; tokenId: string; modelId: string }
  /** Combat block and max HP refreshed from the linked sheet. */
  | { type: "token.synced"; tokenId: string; stats: CombatStats; hpMax: number }
  /** The room follows the campaign system; NPC stats are re-derived for it. */
  | { type: "rules.set"; rules: CombatRules }
  | { type: "message.posted"; message: ChatMessage }
  | { type: "combat.started"; order: CombatState["order"] }
  | { type: "combat.turn" }
  | { type: "combat.ended" }
  | { type: "map.replaced"; map: MapDocument };

export interface LoggedEvent {
  id: string;
  at: string;
  actorId: string;
  event: RoomEvent;
}

export interface RoomState {
  campaignId: string;
  /** Combat rules of the campaign's system. */
  rules: CombatRules;
  map: RoomMap;
  tokens: RoomToken[];
  messages: ChatMessage[];
  combat: CombatState;
  log: LoggedEvent[];
  createdAt: string;
}
