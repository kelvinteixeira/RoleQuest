/**
 * Local implementations of the repository contracts.
 * Behaviour mirrors what the Supabase versions must guarantee (unique e-mails,
 * no account enumeration on password reset, copies instead of live references).
 */
import type {
  AuthRepository,
  CampaignRepository,
  CharacterRepository,
  InviteLinkRepository,
  ChronicleRepository,
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

  async accessToken() {
    return null;
  },

  async requestPasswordReset() {
    // Local mode sends no e-mail. Supabase Auth delivers the reset link.
    return respond(undefined);
  },

  async updatePassword() {
    throw new AppError("validation", "No modo local não há link de redefinição de senha.");
  },

  async resume(stored) {
    // Local sessions live in the session store; only an expired one is dropped.
    return stored && new Date(stored.expiresAt).getTime() > Date.now() ? stored : null;
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

/** A v4 UUID without dashes, like the database default. */
export const newInviteCode = () => crypto.randomUUID().replace(/-/g, "");

const inviteLinks: InviteLinkRepository = {
  async getForCampaign(campaignId) {
    return respond(getDb().inviteLinks.find((l) => l.campaignId === campaignId) ?? null);
  },
  async renew(campaignId) {
    const db = getDb();
    const link = { campaignId, code: newInviteCode(), createdAt: nowIso() };
    db.inviteLinks = [...db.inviteLinks.filter((l) => l.campaignId !== campaignId), link];
    commit();
    return respond(link);
  },
  async revoke(campaignId) {
    const db = getDb();
    db.inviteLinks = db.inviteLinks.filter((l) => l.campaignId !== campaignId);
    commit();
    return respond(undefined);
  },
  async preview(code, userId) {
    const db = getDb();
    const link = db.inviteLinks.find((l) => l.code === code);
    const campaign = link && db.campaigns.find((c) => c.id === link.campaignId);
    if (!campaign) return respond(null);
    const owner = db.users.find((u) => u.profile.id === campaign.ownerId)?.profile;
    const players = campaign.members.filter((m) => m.role === "player").length;
    return respond({
      campaignId: campaign.id,
      campaignName: campaign.name,
      tagline: campaign.tagline,
      systemId: campaign.systemId,
      systemName: db.customSystems.find((s) => s.system.id === campaign.systemId && s.ownerId === campaign.ownerId)?.system.name ?? null,
      gameMasterName: campaign.gameMaster.narratorName || owner?.displayName || "Mestre",
      freeSeats: Math.max(0, campaign.playerPolicy.maxPlayers - players),
      alreadyMember: campaign.members.some((m) => m.userId === userId),
    });
  },
  async join(code, userId) {
    const db = getDb();
    const link = db.inviteLinks.find((l) => l.code === code);
    const campaign = link && db.campaigns.find((c) => c.id === link.campaignId);
    if (!campaign) throw new AppError("not_found", "Este link de convite não vale mais. Peça um novo ao mestre.");
    if (campaign.members.some((m) => m.userId === userId)) return respond(campaign.id);
    if (campaign.members.filter((m) => m.role === "player").length >= campaign.playerPolicy.maxPlayers) {
      throw new AppError("validation", "A campanha já está com todas as vagas preenchidas.");
    }
    campaign.members.push({ userId, role: "player", characterId: null, joinedAt: nowIso() });
    campaign.updatedAt = nowIso();
    commit();
    return respond(campaign.id);
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
  async listKnownForCampaign(campaignId) {
    // Same filtering as the database function known_npcs().
    return respond(
      getDb()
        .npcs.filter((n) => n.campaignId === campaignId && n.known)
        .map((n) => ({ ...n, attitude: "neutral" as const, modelId: undefined, secretNotes: "", stats: { ...n.stats, hp: 0 }, facts: n.facts.filter((f) => f.revealed) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
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

const chronicles: ChronicleRepository = {
  async listEpisodes(campaignId) {
    return respond(getDb().episodes.filter((e) => e.campaignId === campaignId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },
  async getEpisode(id) {
    return respond(getDb().episodes.find((e) => e.id === id) ?? null);
  },
  async createEpisode(input, userId) {
    const now = nowIso();
    const episode = { ...input, id: createId("ep"), createdBy: userId, createdAt: now, updatedAt: now };
    getDb().episodes.push(episode);
    commit();
    return respond(episode);
  },
  async updateEpisode(id, patch) {
    const db = getDb();
    const index = db.episodes.findIndex((e) => e.id === id);
    if (index < 0) throw new AppError("not_found", "Episódio não encontrado.");
    db.episodes[index] = { ...db.episodes[index], ...patch, updatedAt: nowIso() };
    commit();
    return respond(db.episodes[index]);
  },
  async removeEpisode(id) {
    const db = getDb();
    const episode = db.episodes.find((e) => e.id === id);
    db.episodes = db.episodes.filter((e) => e.id !== id);
    commit();
    await Promise.all(Object.values(episode?.images ?? {}).map((ref) => mockImages.remove?.(ref)));
    return respond(undefined);
  },
  // Images stay in this browser (IndexedDB), like imported map images.
  putImage: (_campaignId, _episodeId, _key, blob) => mockImages.put(blob),
  getImage: (ref) => mockImages.get(ref),
  removeImage: async (ref) => {
    await mockImages.remove?.(ref);
  },
};

export const mockRepositories: Repositories = { auth, users, campaigns, sessions, inviteLinks, characters, library, systems, maps, images: mockImages, npcs, encounters, journal, roomSync: null, chronicles };
export { resetMockDatabase } from "./database";
