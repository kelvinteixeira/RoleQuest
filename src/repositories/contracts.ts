/**
 * Data-access contracts. Services depend only on these interfaces.
 * Implementations: `mock/` today, `supabase/` in Phase 7.
 */
import type { ID } from "@/types/common";
import type { AuthSession, ProfileUpdate, SignUpInput, UserProfile } from "@/types/user";
import type {
  Campaign,
  GameSession,
  NewCampaignInput,
  InviteLink,
  InvitePreview,
  NewSessionInput,
} from "@/types/campaign";
import type { Character, NewCharacterInput } from "@/types/character";
import type { LibraryAsset } from "@/types/library";
import type { SavedMap } from "@/types/map";
import type { Encounter, EncounterInput, JournalEntry, JournalInput, Npc, NpcInput } from "@/types/gm";
import type { SystemTemplate } from "@/types/system";
import type { ChronicleEpisode, ChronicleEpisodeInput } from "@/types/chronicle";
import type { AudioTrack } from "@/features/audio-engine/catalog";

export interface AuthRepository {
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Sends a reset link. Resolves even for unknown e-mails (no account enumeration). */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password from the reset link's recovery session; returns the signed-in session. */
  updatePassword(password: string): Promise<AuthSession>;
  /** The backend access token for calls to the app's own server routes (null in local mode). */
  accessToken(): Promise<string | null>;
  /** On app load: the session that is still valid (the stored one, refreshed), or null. */
  resume(stored: AuthSession | null): Promise<AuthSession | null>;
}

export interface UserRepository {
  getById(id: ID): Promise<UserProfile | null>;
  getMany(ids: ID[]): Promise<UserProfile[]>;
  update(id: ID, patch: ProfileUpdate): Promise<UserProfile>;
  isUsernameTaken(username: string, exceptUserId?: ID): Promise<boolean>;
}

export interface CampaignRepository {
  listForUser(userId: ID): Promise<Campaign[]>;
  getById(id: ID): Promise<Campaign | null>;
  create(input: NewCampaignInput): Promise<Campaign>;
  update(id: ID, patch: Partial<NewCampaignInput>): Promise<Campaign>;
}

export interface SessionRepository {
  listForCampaigns(campaignIds: ID[]): Promise<GameSession[]>;
  create(input: NewSessionInput): Promise<GameSession>;
}

export interface InviteLinkRepository {
  /** The campaign's link (GMs only), or null when it is turned off. */
  getForCampaign(campaignId: ID): Promise<InviteLink | null>;
  /** Creates the link, or replaces its code: old links stop working. */
  renew(campaignId: ID): Promise<InviteLink>;
  /** Turns the link off. */
  revoke(campaignId: ID): Promise<void>;
  /** What the link opens (any signed-in user); null when the code is not valid. */
  preview(code: string, userId: ID): Promise<InvitePreview | null>;
  /** Joins as a player, atomically checking the free seats; returns the campaign id (also when already a member). */
  join(code: string, userId: ID): Promise<ID>;
}

export interface CharacterRepository {
  listForUser(userId: ID): Promise<Character[]>;
  listForCampaign(campaignId: ID): Promise<Character[]>;
  getById(id: ID): Promise<Character | null>;
  create(input: NewCharacterInput): Promise<Character>;
  update(id: ID, patch: Partial<NewCharacterInput>): Promise<Character>;
  remove(id: ID): Promise<void>;
}

export interface LibraryRepository {
  listForUser(userId: ID): Promise<LibraryAsset[]>;
}

/** Only custom systems are stored; built-ins ship with the app. */
export interface SystemRepository {
  listCustom(ownerId: ID): Promise<SystemTemplate[]>;
  getCustom(id: ID): Promise<SystemTemplate | null>;
  saveCustom(ownerId: ID, system: SystemTemplate): Promise<SystemTemplate>;
}

/** Maps saved per campaign (the room keeps its own live copy). */
export interface MapRepository {
  listForCampaign(campaignId: ID): Promise<SavedMap[]>;
  getById(id: ID): Promise<SavedMap | null>;
  /** Creates or replaces by id. */
  save(map: Omit<SavedMap, "createdAt" | "updatedAt">): Promise<SavedMap>;
  remove(id: ID): Promise<void>;
}

/** Pictures used as map backgrounds. */
export interface MapImageRepository {
  /** Stores a map picture; with a campaign it is shared with the campaign's members (Supabase). */
  put(blob: Blob, campaignId?: ID): Promise<ID>;
  get(id: ID): Promise<Blob | null>;
  remove?(id: ID): Promise<void>;
}

/** GM tools: NPCs, encounters and the campaign journal. */
export interface NpcRepository {
  listForCampaign(campaignId: ID): Promise<Npc[]>;
  /** For any member: known NPCs with secrets removed and only revealed facts (filtered by the backend). */
  listKnownForCampaign(campaignId: ID): Promise<Npc[]>;
  getById(id: ID): Promise<Npc | null>;
  create(input: NpcInput): Promise<Npc>;
  update(id: ID, patch: Partial<NpcInput>): Promise<Npc>;
  remove(id: ID): Promise<void>;
}

export interface EncounterRepository {
  listForCampaign(campaignId: ID): Promise<Encounter[]>;
  create(input: EncounterInput): Promise<Encounter>;
  update(id: ID, patch: Partial<EncounterInput>): Promise<Encounter>;
  remove(id: ID): Promise<void>;
}

export interface JournalRepository {
  listForCampaign(campaignId: ID): Promise<JournalEntry[]>;
  add(entries: JournalInput[]): Promise<JournalEntry[]>;
  update(id: ID, patch: Partial<Pick<JournalEntry, "text" | "private" | "kind" | "dismissed">>): Promise<JournalEntry>;
  remove(id: ID): Promise<void>;
}

/** The audio centre's uploaded tracks (members play them; GMs manage them). */
export interface AudioTrackRepository {
  list(campaignId: ID): Promise<AudioTrack[]>;
  upload(campaignId: ID, file: Blob, title: string, userId: ID): Promise<AudioTrack>;
  remove(track: AudioTrack): Promise<void>;
  /** The file itself, by its reference (null when it is gone). */
  file(ref: string): Promise<Blob | null>;
}

/** Chronicles Studio: episodes and their generated images. GMs only. */
export interface ChronicleRepository {
  listEpisodes(campaignId: ID): Promise<ChronicleEpisode[]>;
  getEpisode(id: ID): Promise<ChronicleEpisode | null>;
  createEpisode(input: ChronicleEpisodeInput, userId: ID): Promise<ChronicleEpisode>;
  updateEpisode(id: ID, patch: Partial<ChronicleEpisodeInput>): Promise<ChronicleEpisode>;
  removeEpisode(id: ID): Promise<void>;
  /** Stores a generated image; returns the reference kept in the episode. */
  putImage(campaignId: ID, episodeId: ID, key: string, blob: Blob): Promise<string>;
  /** null when the image no longer exists; throws when it can't be read right now. */
  getImage(ref: string): Promise<Blob | null>;
  removeImage(ref: string): Promise<void>;
}

/** An intent a member sent to the table's host (see features/virtual-tabletop/sync). */
export interface RoomIntentEnvelope {
  id: string;
  userId: ID;
  intent: unknown;
  createdAt: string;
}

export interface RoomPresenceEntry {
  userId: ID;
  hosting: boolean;
  seenAt: string;
}

export type RoomSyncStatus = "connecting" | "connected" | "offline";

export interface RoomSyncHandlers {
  /** This member's view changed (`null`: too big for the notification, read it again). */
  onView?: (view: unknown | null) => void;
  /** The players' map changed: read it again. */
  onPlayerMap?: () => void;
  /** A member sent an intent (the host listens; RLS lets only GMs see others' intents). */
  onIntent?: (intent: RoomIntentEnvelope) => void;
  /** Someone arrived, left or is still there: read the presence again. */
  onPresence?: () => void;
  onStatus?: (status: RoomSyncStatus) => void;
}

/**
 * The table in real time. Payloads are opaque JSON here; the virtual tabletop
 * owns their shape (views.ts, intents.ts). Absent in local mode: the room then
 * lives on this device only.
 */
export interface RoomSyncRepository {
  /** Takes (or keeps) the host role for this client; `takeover` takes it from another GM. */
  claimHost(campaignId: ID, clientId: string, takeover: boolean): Promise<{ hosting: boolean; holderUserId: ID | null }>;
  releaseHost(campaignId: ID, clientId: string): Promise<void>;
  /** Host: the saved full state (null when the room was never saved). */
  loadState(campaignId: ID): Promise<unknown | null>;
  /** Host: saves the full state; false when this client no longer holds the table (taken over). */
  saveState(campaignId: ID, clientId: string, state: unknown): Promise<boolean>;
  /** Host: members' views (and the players' map when it changed) in one write; false when the table was taken over. */
  publish(campaignId: ID, clientId: string, views: { userId: ID; view: unknown; revision: number }[], map: { map: unknown; revision: number } | null): Promise<boolean>;
  loadView(campaignId: ID, userId: ID): Promise<unknown | null>;
  loadPlayerMap(campaignId: ID): Promise<{ map: unknown; revision: number } | null>;
  sendIntent(campaignId: ID, intent: unknown): Promise<void>;
  /** Host: intents not handled yet (sent while it was away or reconnecting), at most a minute old. */
  pendingIntents(campaignId: ID): Promise<RoomIntentEnvelope[]>;
  clearIntents(ids: string[]): Promise<void>;
  heartbeat(campaignId: ID, userId: ID, hosting: boolean): Promise<void>;
  leave(campaignId: ID, userId: ID): Promise<void>;
  presence(campaignId: ID): Promise<RoomPresenceEntry[]>;
  subscribe(campaignId: ID, userId: ID, handlers: RoomSyncHandlers): () => void;
}

export interface Repositories {
  auth: AuthRepository;
  users: UserRepository;
  campaigns: CampaignRepository;
  sessions: SessionRepository;
  inviteLinks: InviteLinkRepository;
  characters: CharacterRepository;
  library: LibraryRepository;
  systems: SystemRepository;
  maps: MapRepository;
  images: MapImageRepository;
  npcs: NpcRepository;
  encounters: EncounterRepository;
  journal: JournalRepository;
  /** null in local mode (no real-time backend). */
  roomSync: RoomSyncRepository | null;
  chronicles: ChronicleRepository;
  audioTracks: AudioTrackRepository;
}
