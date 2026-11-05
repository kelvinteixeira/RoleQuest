/**
 * Data-access contracts. Services depend only on these interfaces.
 * Implementations: `mock/` today, `supabase/` in Phase 7.
 */
import type { ID } from "@/types/common";
import type { AuthSession, ProfileUpdate, SignUpInput, UserProfile } from "@/types/user";
import type {
  Campaign,
  CampaignInvite,
  GameSession,
  InviteStatus,
  NewCampaignInput,
  NewInviteInput,
  NewSessionInput,
} from "@/types/campaign";
import type { Character, NewCharacterInput } from "@/types/character";
import type { LibraryAsset } from "@/types/library";
import type { SavedMap } from "@/types/map";
import type { Encounter, EncounterInput, JournalEntry, JournalInput, Npc, NpcInput } from "@/types/gm";
import type { SystemTemplate } from "@/types/system";

export interface AuthRepository {
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Sends a reset link. Resolves even for unknown e-mails (no account enumeration). */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password from the reset link's recovery session; returns the signed-in session. */
  updatePassword(password: string): Promise<AuthSession>;
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

export interface InviteRepository {
  listForEmail(email: string): Promise<CampaignInvite[]>;
  listForCampaign(campaignId: ID): Promise<CampaignInvite[]>;
  getById(id: ID): Promise<CampaignInvite | null>;
  create(input: NewInviteInput): Promise<CampaignInvite>;
  updateStatus(id: ID, status: InviteStatus): Promise<CampaignInvite>;
  /** Joins the invited user as a player and marks the invite accepted, atomically (checks the free seats). */
  accept(id: ID, userId: ID): Promise<CampaignInvite>;
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
  put(blob: Blob): Promise<ID>;
  get(id: ID): Promise<Blob | null>;
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

export interface Repositories {
  auth: AuthRepository;
  users: UserRepository;
  campaigns: CampaignRepository;
  sessions: SessionRepository;
  invites: InviteRepository;
  characters: CharacterRepository;
  library: LibraryRepository;
  systems: SystemRepository;
  maps: MapRepository;
  images: MapImageRepository;
  npcs: NpcRepository;
  encounters: EncounterRepository;
  journal: JournalRepository;
}
