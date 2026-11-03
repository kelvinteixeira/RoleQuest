import type { RollResult } from "@/features/dice/dice-engine";

export type TokenKind = "pc" | "npc" | "enemy";
/** Who drives the token: the GM, a (future) human player, or a local test bot. */
export type TokenController = "gm" | "player" | "bot";

/**
 * Simplified combat block used by the first room version. Real per-system
 * stats come from character sheets (Phase 2); until then every system uses
 * "d20 + attack bonus vs. defense".
 */
export interface CombatStats {
  defense: number;
  attackBonus: number;
  damage: string;
  /** Squares per turn. */
  speed: number;
  initiativeBonus: number;
  /** Healing uses per combat (bots with a support role). */
  heals?: number;
}

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
}

export interface RoomMap {
  name: string;
  cols: number;
  rows: number;
  /** Distance represented by one square (shown when measuring). */
  cellDistance: number;
  cellUnit: string;
  /** Blocking cells as "x,y". */
  walls: string[];
}

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
  | { type: "message.posted"; message: ChatMessage }
  | { type: "combat.started"; order: CombatState["order"] }
  | { type: "combat.turn" }
  | { type: "combat.ended" };

export interface LoggedEvent {
  id: string;
  at: string;
  actorId: string;
  event: RoomEvent;
}

export interface RoomState {
  campaignId: string;
  map: RoomMap;
  tokens: RoomToken[];
  messages: ChatMessage[];
  combat: CombatState;
  log: LoggedEvent[];
  createdAt: string;
}
