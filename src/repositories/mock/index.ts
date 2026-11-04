/**
 * Local implementations of the repository contracts.
 * Behaviour mirrors what the Supabase versions must guarantee (unique e-mails,
 * no account enumeration on password reset, copies instead of live references).
 */
import type {
  AuthRepository,
  CampaignRepository,
  CharacterRepository,
  InviteRepository,
  LibraryRepository,
  EncounterRepository,
  JournalRepository,
  MapRepository,
  NpcRepository,
  Repositories,
  SessionRepository,
  SystemRepository,
  UserRepository,
} from "../contracts";
import type { AuthSession, UserProfile } from "@/types/user";
import { AppError } from "@/lib/errors";
import { createId, slugify } from "@/lib/id";
import { sha256Hex } from "@/lib/crypto";
import { AVATAR_COLORS } from "@/constants/campaign";
import { commit, getDb, nowIso, respond } from "./database";
import { mockImages } from "./images";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashPassword = (email: string, password: string) => sha256Hex(`${normalizeEmail(email)}:${password}`);

function issueSession(profile: UserProfile): AuthSession {
  return {
    userId: profile.id,
    email: profile.email,
    accessToken: createId("local_token"),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

function uniqueUsername(base: string): string {
  const db = getDb();
  const root = slugify(base).replace(/-/g, ".") || "aventureiro";
  let candidate = root;
  let n = 1;
  while (db.users.some((u) => u.profile.username === candidate)) candidate = `${root}${++n}`;
  return candidate;
}

const auth: AuthRepository = {
  async signIn(email, password) {
    const record = getDb().users.find((u) => u.profile.email === normalizeEmail(email));
    const hash = await hashPassword(email, password);
    if (!record || !record.passwordHash || record.passwordHash !== hash) {
      await respond(null);
      throw new AppError("invalid_credentials");
    }
    return respond(issueSession(record.profile));
  },

  async signUp({ email, password, displayName }) {
    const db = getDb();
    const normalized = normalizeEmail(email);
    if (db.users.some((u) => u.profile.email === normalized)) {
      await respond(null);
      throw new AppError("email_taken", undefined, { email: "Já existe uma conta com este e-mail." });
    }
    const now = nowIso();
    const profile: UserProfile = {
      id: createId("user"),
      email: normalized,
      displayName: displayName.trim(),
      username: uniqueUsername(normalized.split("@")[0]),
      avatarUrl: null,
      avatarColor: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length],
      bio: "",
      playStyle: "both",
      favoriteSystemIds: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };
    db.users.push({ profile, passwordHash: await hashPassword(normalized, password) });
    commit();
    return respond(issueSession(profile));
  },

  async signOut() {
    return respond(undefined);
  },

  async requestPasswordReset() {
    // Local mode sends no e-mail. Supabase Auth will deliver the reset link.
    return respond(undefined);
  },
};

const users: UserRepository = {
  async getById(id) {
    return respond(getDb().users.find((u) => u.profile.id === id)?.profile ?? null);
  },
  async getMany(ids) {
    const set = new Set(ids);
    return respond(getDb().users.filter((u) => set.has(u.profile.id)).map((u) => u.profile));
  },
  async update(id, patch) {
    const record = getDb().users.find((u) => u.profile.id === id);
    if (!record) throw new AppError("not_found");
    record.profile = { ...record.profile, ...patch, updatedAt: nowIso() };
    commit();
    return respond(record.profile);
  },
  async isUsernameTaken(username, exceptUserId) {
    return respond(getDb().users.some((u) => u.profile.username === username && u.profile.id !== exceptUserId));
  },
};

const campaigns: CampaignRepository = {
  async listForUser(userId) {
    return respond(getDb().campaigns.filter((c) => c.members.some((m) => m.userId === userId)));
  },
  async getById(id) {
    return respond(getDb().campaigns.find((c) => c.id === id) ?? null);
  },
  async create(input) {
    const now = nowIso();
    const campaign = { ...input, id: createId("c"), lastPlayedAt: null, createdAt: now, updatedAt: now };
    getDb().campaigns.push(campaign);
    commit();
    return respond(campaign);
  },
  async update(id, patch) {
    const db = getDb();
    const index = db.campaigns.findIndex((c) => c.id === id);
    if (index < 0) throw new AppError("not_found");
    db.campaigns[index] = { ...db.campaigns[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.campaigns[index]);
  },
  async addMember(campaignId, member) {
    const campaign = getDb().campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new AppError("not_found");
    if (!campaign.members.some((m) => m.userId === member.userId)) {
      campaign.members.push(member);
      campaign.updatedAt = nowIso();
      commit();
    }
    return respond(campaign);
  },
};

const sessions: SessionRepository = {
  async listForCampaigns(campaignIds) {
    const set = new Set(campaignIds);
    return respond(getDb().sessions.filter((s) => set.has(s.campaignId)));
  },
  async create(input) {
    const now = nowIso();
    const session = { ...input, id: createId("s"), createdAt: now, updatedAt: now };
    getDb().sessions.push(session);
    commit();
    return respond(session);
  },
};

const invites: InviteRepository = {
  async listForEmail(email) {
    return respond(getDb().invites.filter((i) => i.email === normalizeEmail(email)));
  },
  async listForCampaign(campaignId) {
    return respond(getDb().invites.filter((i) => i.campaignId === campaignId));
  },
  async getById(id) {
    return respond(getDb().invites.find((i) => i.id === id) ?? null);
  },
  async create(input) {
    const now = nowIso();
    const invite = { ...input, email: normalizeEmail(input.email), id: createId("inv"), status: "pending" as const, createdAt: now, updatedAt: now };
    getDb().invites.push(invite);
    commit();
    return respond(invite);
  },
  async updateStatus(id, status) {
    const invite = getDb().invites.find((i) => i.id === id);
    if (!invite) throw new AppError("not_found");
    invite.status = status;
    invite.updatedAt = nowIso();
    commit();
    return respond(invite);
  },
};

const characters: CharacterRepository = {
  async listForUser(userId) {
    return respond(getDb().characters.filter((c) => c.ownerId === userId));
  },
  async listForCampaign(campaignId) {
    return respond(getDb().characters.filter((c) => c.campaignId === campaignId));
  },
  async getById(id) {
    return respond(getDb().characters.find((c) => c.id === id) ?? null);
  },
  async create(input) {
    const now = nowIso();
    const character = { ...input, id: createId("ch"), createdAt: now, updatedAt: now };
    getDb().characters.push(character);
    commit();
    return respond(character);
  },
  async update(id, patch) {
    const db = getDb();
    const index = db.characters.findIndex((c) => c.id === id);
    if (index < 0) throw new AppError("not_found");
    db.characters[index] = { ...db.characters[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.characters[index]);
  },
  async remove(id) {
    const db = getDb();
    db.characters = db.characters.filter((c) => c.id !== id);
    // Unlink from campaign tables, like a foreign key with ON DELETE SET NULL.
    for (const campaign of db.campaigns) for (const m of campaign.members) if (m.characterId === id) m.characterId = null;
    commit();
    return respond(undefined);
  },
};

const library: LibraryRepository = {
  async listForUser(userId) {
    return respond(getDb().library.filter((a) => a.ownerId === userId));
  },
};

const systems: SystemRepository = {
  async listCustom(ownerId) {
    return respond(getDb().customSystems.filter((s) => s.ownerId === ownerId).map((s) => s.system));
  },
  async getCustom(id) {
    return respond(getDb().customSystems.find((s) => s.system.id === id)?.system ?? null);
  },
  async saveCustom(ownerId, system) {
    const db = getDb();
    const index = db.customSystems.findIndex((s) => s.system.id === system.id);
    if (index >= 0) db.customSystems[index] = { ownerId, system };
    else db.customSystems.push({ ownerId, system });
    commit();
    return respond(system);
  },
};

const maps: MapRepository = {
  async listForCampaign(campaignId) {
    return respond(getDb().maps.filter((m) => m.campaignId === campaignId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },
  async getById(id) {
    return respond(getDb().maps.find((m) => m.id === id) ?? null);
  },
  async save(input) {
    const db = getDb();
    const now = nowIso();
    const index = db.maps.findIndex((m) => m.id === input.id);
    const saved = index >= 0 ? { ...db.maps[index], ...input, updatedAt: now } : { ...input, createdAt: now, updatedAt: now };
    if (index >= 0) db.maps[index] = saved;
    else db.maps.push(saved);
    commit();
    return respond(saved);
  },
  async remove(id) {
    const db = getDb();
    db.maps = db.maps.filter((m) => m.id !== id);
    commit();
    return respond(undefined);
  },
};

const npcs: NpcRepository = {
  async listForCampaign(campaignId) {
    return respond(getDb().npcs.filter((n) => n.campaignId === campaignId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
  },
  async getById(id) {
    return respond(getDb().npcs.find((n) => n.id === id) ?? null);
  },
  async create(input) {
    const now = nowIso();
    const npc = { ...input, id: createId("npc"), createdAt: now, updatedAt: now };
    getDb().npcs.push(npc);
    commit();
    return respond(npc);
  },
  async update(id, patch) {
    const db = getDb();
    const index = db.npcs.findIndex((n) => n.id === id);
    if (index < 0) throw new AppError("not_found");
    db.npcs[index] = { ...db.npcs[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.npcs[index]);
  },
  async remove(id) {
    const db = getDb();
    db.npcs = db.npcs.filter((n) => n.id !== id);
    // Like ON DELETE CASCADE on encounter entries.
    for (const e of db.encounters) e.entries = e.entries.filter((x) => x.npcId !== id);
    commit();
    return respond(undefined);
  },
};

const encounters: EncounterRepository = {
  async listForCampaign(campaignId) {
    return respond(getDb().encounters.filter((e) => e.campaignId === campaignId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },
  async create(input) {
    const now = nowIso();
    const encounter = { ...input, id: createId("enc"), createdAt: now, updatedAt: now };
    getDb().encounters.push(encounter);
    commit();
    return respond(encounter);
  },
  async update(id, patch) {
    const db = getDb();
    const index = db.encounters.findIndex((e) => e.id === id);
    if (index < 0) throw new AppError("not_found");
    db.encounters[index] = { ...db.encounters[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.encounters[index]);
  },
  async remove(id) {
    const db = getDb();
    db.encounters = db.encounters.filter((e) => e.id !== id);
    commit();
    return respond(undefined);
  },
};

const journal: JournalRepository = {
  async listForCampaign(campaignId) {
    return respond(getDb().journal.filter((j) => j.campaignId === campaignId).sort((a, b) => a.at.localeCompare(b.at)));
  },
  async add(inputs) {
    const now = nowIso();
    const added = inputs.map((input) => ({ ...input, id: createId("jr"), createdAt: now, updatedAt: now }));
    getDb().journal.push(...added);
    commit();
    return respond(added);
  },
  async update(id, patch) {
    const db = getDb();
    const index = db.journal.findIndex((j) => j.id === id);
    if (index < 0) throw new AppError("not_found");
    db.journal[index] = { ...db.journal[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.journal[index]);
  },
  async remove(id) {
    const db = getDb();
    db.journal = db.journal.filter((j) => j.id !== id);
    commit();
    return respond(undefined);
  },
};

export const mockRepositories: Repositories = { auth, users, campaigns, sessions, invites, characters, library, systems, maps, images: mockImages, npcs, encounters, journal };
export { resetMockDatabase } from "./database";
