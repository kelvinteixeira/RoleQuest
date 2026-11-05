import type { ID, ISODateString, Timestamps } from "./common";
import type { SystemId } from "./system";

export type CampaignStatus = "planning" | "active" | "paused" | "completed";
export type CampaignRole = "game_master" | "player";

export interface CampaignMember {
  userId: ID;
  role: CampaignRole;
  characterId: ID | null;
  joinedAt: ISODateString;
}

export interface WorldSetup {
  name: string;
  premise: string;
  tone: string[];
  startingLocation: string;
}

export interface GameMasterPersona {
  /** How the narrator signs in-game messages (may differ from the user's name). */
  narratorName: string;
  narrationStyle: string;
  notes: string;
}

export interface PlayerPolicy {
  maxPlayers: number;
  playersCanEditSheets: boolean;
  playersCanMoveOwnToken: boolean;
  allowPrivateMessages: boolean;
  rollsPublicByDefault: boolean;
}

export interface Campaign extends Timestamps {
  id: ID;
  name: string;
  tagline: string;
  systemId: SystemId;
  visualStyleId: string;
  status: CampaignStatus;
  ownerId: ID;
  members: CampaignMember[];
  world: WorldSetup;
  gameMaster: GameMasterPersona;
  playerPolicy: PlayerPolicy;
  lastPlayedAt: ISODateString | null;
}

export type NewCampaignInput = Omit<Campaign, "id" | "createdAt" | "updatedAt" | "lastPlayedAt">;

export type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface GameSession extends Timestamps {
  id: ID;
  campaignId: ID;
  number: number;
  title: string;
  status: SessionStatus;
  scheduledAt: ISODateString;
  durationMinutes: number;
  summary: string;
  /** Short notable moments; full event log arrives with Chronicles Studio. */
  highlights: string[];
  attendeeIds: ID[];
}

export type NewSessionInput = Omit<GameSession, "id" | "createdAt" | "updatedAt">;

/** A campaign's invite link: whoever opens /join/{code} signed in joins as a player (while there are seats). */
export interface InviteLink {
  campaignId: ID;
  code: string;
  createdAt: ISODateString;
}

/** What an invite link shows before joining: enough to decide, nothing private. */
export interface InvitePreview {
  campaignId: ID;
  campaignName: string;
  tagline: string;
  systemId: SystemId;
  /** Custom systems can't be read before joining: their name comes with the preview. Null for built-in ones. */
  systemName: string | null;
  gameMasterName: string;
  freeSeats: number;
  alreadyMember: boolean;
}
