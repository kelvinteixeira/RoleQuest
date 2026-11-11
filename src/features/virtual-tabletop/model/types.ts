import type { RollResult } from "@/features/dice/dice-engine";
import type { Ambient, DoorState, MapDocument, TrapState } from "@/features/map/model/map-document";
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
  /** Light carried (torch, lantern), radius in squares. */
  light?: number;
  /**
   * Squares per side (2 = large, 3 = huge, 4 = colossal); `x`,`y` is the
   * north-west square of that block. Missing: the body's default (see `sizeOf`).
   */
  size?: number;
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

/**
 * Fog of war. `explored` holds the cell indices the party has seen at some
 * point (or the GM revealed); what they see right now is derived from the
 * player tokens' line of sight.
 */
export interface FogState {
  enabled: boolean;
  /** Vision radius of player characters, in squares. */
  vision: number;
  explored: number[];
}

/** Music playing at the table: a synthesised theme or an uploaded track, from a point in time. */
export interface MusicCue {
  /** Changes on every play (so "play again" restarts it everywhere). */
  id: string;
  source: "theme" | "track";
  /** Theme id, or the uploaded track's id. */
  ref: string;
  title: string;
  /** When it started, by the host's clock: everyone joins at the same point. */
  startedAt: string;
  /** 0..1, the GM's mix (each listener also has their own music volume). */
  volume: number;
  loop: boolean;
}

export interface AmbienceLayer {
  id: string;
  volume: number;
}

/** The table's sound: what the GM put on for everyone. */
export interface TableAudio {
  music: MusicCue | null;
  ambience: AmbienceLayer[];
}

/**
 * A mark a player leaves on the map ("I want to go here"). Players never move
 * tokens themselves: the GM sees the ping and moves the character.
 */
export interface MapPing {
  id: string;
  x: number;
  y: number;
  author: Author;
  /** The character the player wants to move (their token), when they have one. */
  tokenId?: string;
  at: string;
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
  /** `path`: squares crossed on the way (end included); the party explores along it. */
  | { type: "token.moved"; tokenId: string; x: number; y: number; path?: { x: number; y: number }[] }
  | { type: "token.hp"; tokenId: string; delta: number }
  | { type: "token.condition"; tokenId: string; condition: string; on: boolean }
  | { type: "token.stats"; tokenId: string; stats: Partial<CombatStats> }
  | { type: "token.appearance"; tokenId: string; modelId: string }
  /** Combat block and max HP refreshed from the linked sheet; `hpCurrent` when the sheet's HP should win. */
  | { type: "token.synced"; tokenId: string; stats: CombatStats; hpMax: number; hpCurrent?: number }
  /** A player token from an older room gets its character sheet. */
  | { type: "token.linked"; tokenId: string; characterId: string }
  /** The room follows the campaign system; NPC stats are re-derived for it. */
  | { type: "rules.set"; rules: CombatRules }
  | { type: "message.posted"; message: ChatMessage }
  | { type: "combat.started"; order: CombatState["order"] }
  | { type: "combat.turn" }
  /** Tokens joining a running combat with their own initiative (whoever is acting keeps the turn). */
  | { type: "combat.joined"; entries: { tokenId: string; initiative: number }[] }
  | { type: "combat.ended" }
  | { type: "map.replaced"; map: MapDocument }
  /** The map's picture moved (e.g. uploaded from the GM's browser to the backend): only its id changes. */
  | { type: "map.image"; imageId: string }
  | { type: "audio.music"; music: MusicCue | null }
  | { type: "audio.ambience"; ambience: AmbienceLayer[] }
  /** One layer on, off (null) or to a new level: two GMs mixing don't undo each other. */
  | { type: "audio.layer"; id: string; volume: number | null }
  /** Doors open/close/lock, traps get revealed, disarmed or re-armed. */
  | { type: "prop.updated"; propId: string; door?: Partial<DoorState>; trap?: Partial<TrapState>; lit?: boolean }
  /** Light carried by a token (0 puts it out). */
  | { type: "token.light"; tokenId: string; radius: number }
  | { type: "lighting.set"; ambient: Ambient }
  | { type: "fog.configured"; enabled?: boolean; vision?: number }
  | { type: "fog.revealed"; cells: number[] }
  | { type: "fog.hidden"; cells: number[] }
  /** A player's ping replaces their previous one. */
  | { type: "ping.placed"; ping: MapPing }
  | { type: "ping.cleared"; pingId: string };

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
  fog: FogState;
  audio: TableAudio;
  /** Players' movement requests (older rooms have none). */
  pings?: MapPing[];
  log: LoggedEvent[];
  createdAt: string;
}
