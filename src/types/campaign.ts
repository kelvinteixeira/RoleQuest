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

export type InviteStatus = "pending" | "accepted" | "declined";

export interface CampaignInvite extends Timestamps {
  id: ID;
  campaignId: ID;
  /** Denormalised preview: invitees cannot read the campaign until they join. */
  campaignName: string;
  systemId: SystemId;
  invitedById: ID;
  invitedByName: string;
  email: string;
  message: string;
  status: InviteStatus;
}

export type NewInviteInput = Omit<CampaignInvite, "id" | "createdAt" | "updatedAt" | "status">;
