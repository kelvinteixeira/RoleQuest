/**
 * Data-access contracts. Services depend only on these interfaces.
 * Implementations: `mock/` today, `supabase/` in Phase 7.
 */
import type { ID } from "@/types/common";
import type { AuthSession, ProfileUpdate, SignUpInput, UserProfile } from "@/types/user";
import type {
  Campaign,
  CampaignInvite,
  CampaignMember,
  GameSession,
  InviteStatus,
  NewCampaignInput,
  NewInviteInput,
  NewSessionInput,
} from "@/types/campaign";
import type { Character, NewCharacterInput } from "@/types/character";
import type { LibraryAsset } from "@/types/library";
import type { SavedMap } from "@/types/map";
import type { SystemTemplate } from "@/types/system";

export interface AuthRepository {
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Sends a reset link. Resolves even for unknown e-mails (no account enumeration). */
  requestPasswordReset(email: string): Promise<void>;
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
  addMember(campaignId: ID, member: CampaignMember): Promise<Campaign>;
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
}
