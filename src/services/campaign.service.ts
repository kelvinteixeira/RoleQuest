import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { rules } from "@/lib/validation";
import { can } from "@/lib/permissions";
import { createCustomSystem, type CustomSystemSeed } from "@/features/systems/templates";
import { systemService, type SystemSummary } from "./system.service";
import type { ID } from "@/types/common";
import type {
  Campaign,
  CampaignRole,
  GameMasterPersona,
  GameSession,
  InvitePreview,
  PlayerPolicy,
  WorldSetup,
} from "@/types/campaign";
import type { Character } from "@/types/character";
import type { BuiltInSystemId, SystemTemplate } from "@/types/system";
import type { UserProfile } from "@/types/user";

/* ---------- View models ---------- */

export type MemberPreview = Pick<UserProfile, "id" | "displayName" | "avatarColor" | "avatarUrl">;

export interface CampaignCardModel {
  campaign: Campaign;
  role: CampaignRole;
  system: SystemSummary;
  members: MemberPreview[];
  nextSession: GameSession | null;
  completedSessions: number;
}

export interface CampaignOverview {
  campaign: Campaign;
  role: CampaignRole;
  system: SystemTemplate;
  members: { profile: MemberPreview; role: CampaignRole; character: Character | null }[];
  upcomingSessions: GameSession[];
  pastSessions: GameSession[];
  /** The session being played now: live, or scheduled to have started in the last 12 hours and not closed yet. */
  currentSession: GameSession | null;
}

export interface InvitePreviewModel {
  preview: InvitePreview;
  system: SystemSummary;
}

/** Accepts a pasted invite link (…/join/{code}) or the bare code. */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  const match = text.match(/\/join\/([A-Za-z0-9_-]{6,64})/) ?? text.match(/^([A-Za-z0-9_-]{6,64})$/);
  return match ? match[1] : null;
}

/* ---------- Helpers shared with the dashboard ---------- */

export function roleOf(campaign: Campaign, userId: ID): CampaignRole | null {
  return campaign.members.find((m) => m.userId === userId)?.role ?? null;
}

const PLAYING_WINDOW_MS = 12 * 60 * 60 * 1000;

/** The session under way: one marked live, else one scheduled to start within the last 12 hours. */
export function currentSessionOf(sessions: GameSession[], now = Date.now()): GameSession | null {
  const live = sessions.find((s) => s.status === "live");
  if (live) return live;
  return (
    sessions
      .filter((s) => s.status === "scheduled" && new Date(s.scheduledAt).getTime() <= now && now - new Date(s.scheduledAt).getTime() <= PLAYING_WINDOW_MS)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0] ?? null
  );
}

export function isUpcoming(session: GameSession, now = Date.now()): boolean {
  return session.status === "scheduled" && new Date(session.scheduledAt).getTime() >= now;
}

const byDateAsc = (a: GameSession, b: GameSession) => a.scheduledAt.localeCompare(b.scheduledAt);
const byDateDesc = (a: GameSession, b: GameSession) => b.scheduledAt.localeCompare(a.scheduledAt);

function toPreview(p: UserProfile): MemberPreview {
  return { id: p.id, displayName: p.displayName, avatarColor: p.avatarColor, avatarUrl: p.avatarUrl };
}

export async function buildCampaignCards(campaigns: Campaign[], userId: ID, sessions: GameSession[]): Promise<CampaignCardModel[]> {
  const repo = repositories();
  const [systems, profiles] = await Promise.all([
    systemService.summaries(campaigns.map((c) => c.systemId)),
    repo.users.getMany([...new Set(campaigns.flatMap((c) => c.members.map((m) => m.userId)))]),
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, toPreview(p)]));

  return campaigns.map((campaign) => {
    const own = sessions.filter((s) => s.campaignId === campaign.id);
    return {
      campaign,
      role: roleOf(campaign, userId) ?? "player",
      system: systems.get(campaign.systemId)!,
      members: campaign.members.map((m) => profileById.get(m.userId)).filter((p): p is MemberPreview => !!p),
      nextSession: own.filter((s) => isUpcoming(s)).sort(byDateAsc)[0] ?? null,
      completedSessions: own.filter((s) => s.status === "completed").length,
    };
  });
}

/* ---------- Campaign creation ---------- */

export type SystemChoice = { kind: "builtin"; id: BuiltInSystemId } | { kind: "custom"; seed: CustomSystemSeed };

export interface CreateCampaignCommand {
  name: string;
  tagline: string;
  system: SystemChoice;
  visualStyleId: string;
  gameMaster: GameMasterPersona;
  playerPolicy: PlayerPolicy;
  world: WorldSetup;
  firstSession: { title: string; scheduledAt: string; durationMinutes: number; notes: string } | null;
}

export const CAMPAIGN_LIMITS = { nameMin: 3, nameMax: 60, maxPlayers: 12 } as const;

/** Field-level validation, reused by each wizard step. Keys are dotted paths. */
export function validateCreateCampaign(cmd: CreateCampaignCommand): Record<string, string> {
  const errors: Record<string, string> = {};
  const check = (key: string, message: string | null) => {
    if (message && !errors[key]) errors[key] = message;
  };

  check("name", rules.required("Dê um nome à campanha.")(cmd.name));
  check("name", rules.minLength(CAMPAIGN_LIMITS.nameMin)(cmd.name));
  check("name", rules.maxLength(CAMPAIGN_LIMITS.nameMax)(cmd.name));
  check("tagline", rules.maxLength(160)(cmd.tagline));

  if (cmd.system.kind === "custom") {
    check("system.name", rules.required("Dê um nome ao seu sistema.")(cmd.system.seed.name));
    check("system.name", rules.maxLength(40)(cmd.system.seed.name));
  }

  check("gameMaster.narratorName", rules.maxLength(40)(cmd.gameMaster.narratorName));

  const { maxPlayers } = cmd.playerPolicy;
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > CAMPAIGN_LIMITS.maxPlayers) {
    errors["playerPolicy.maxPlayers"] = `Entre 1 e ${CAMPAIGN_LIMITS.maxPlayers} jogadores.`;
  }

  check("world.name", rules.maxLength(60)(cmd.world.name));
  check("world.premise", rules.maxLength(600)(cmd.world.premise));

  if (cmd.firstSession) {
    check("firstSession.title", rules.required("Dê um título à primeira sessão.")(cmd.firstSession.title));
    const when = new Date(cmd.firstSession.scheduledAt).getTime();
    if (Number.isNaN(when)) errors["firstSession.scheduledAt"] = "Escolha data e horário.";
    else if (when < Date.now()) errors["firstSession.scheduledAt"] = "A sessão precisa estar no futuro.";
  }
  return errors;
}

/* ---------- Service ---------- */

export const campaignService = {
  async listForUser(userId: ID): Promise<CampaignCardModel[]> {
    const repo = repositories();
    const campaigns = await repo.campaigns.listForUser(userId);
    const sessions = await repo.sessions.listForCampaigns(campaigns.map((c) => c.id));
    const cards = await buildCampaignCards(campaigns, userId, sessions);
    return cards.sort((a, b) => (b.campaign.lastPlayedAt ?? b.campaign.updatedAt).localeCompare(a.campaign.lastPlayedAt ?? a.campaign.updatedAt));
  },

  async getOverview(campaignId: ID, userId: ID): Promise<CampaignOverview> {
    const repo = repositories();
    const campaign = await repo.campaigns.getById(campaignId);
    if (!campaign) throw new AppError("not_found", "Campanha não encontrada.");
    const role = roleOf(campaign, userId);
    if (!role) throw new AppError("forbidden", "Você não participa desta campanha.");

    const [system, profiles, characters, sessions] = await Promise.all([
      systemService.get(campaign.systemId),
      repo.users.getMany(campaign.members.map((m) => m.userId)),
      repo.characters.listForCampaign(campaign.id),
      repo.sessions.listForCampaigns([campaign.id]),
    ]);
    if (!system) throw new AppError("not_found", "O sistema desta campanha não está disponível.");

    const profileById = new Map(profiles.map((p) => [p.id, toPreview(p)]));
    const characterById = new Map(characters.map((c) => [c.id, c]));

    return {
      campaign,
      role,
      system,
      members: campaign.members
        .map((m) => ({
          profile: profileById.get(m.userId)!,
          role: m.role,
          character: m.characterId ? (characterById.get(m.characterId) ?? null) : null,
        }))
        .filter((m) => m.profile)
        .sort((a, b) => (a.role === b.role ? 0 : a.role === "game_master" ? -1 : 1)),
      upcomingSessions: sessions.filter((s) => isUpcoming(s)).sort(byDateAsc),
      pastSessions: sessions.filter((s) => s.status === "completed").sort(byDateDesc),
      currentSession: currentSessionOf(sessions),
    };
  },

  /** Marks a session of the campaign as played (GMs only): it moves to the history, and the next one comes up. */
  async completeSession(campaignId: ID, sessionId: ID, user: Pick<UserProfile, "id">): Promise<GameSession> {
    const repo = repositories();
    const campaign = await repo.campaigns.getById(campaignId);
    if (!campaign) throw new AppError("not_found", "Campanha não encontrada.");
    if (!can(roleOf(campaign, user.id), "session:start")) throw new AppError("forbidden", "Só o mestre da campanha marca a sessão como jogada.");
    const [session] = (await repo.sessions.listForCampaigns([campaignId])).filter((s) => s.id === sessionId);
    if (!session) throw new AppError("not_found", "Sessão não encontrada.");
    if (session.status === "completed") return session;
    return repo.sessions.complete(sessionId);
  },

  /** What an invite link opens, before joining. */
  async previewInvite(code: string, user: Pick<UserProfile, "id">): Promise<InvitePreviewModel> {
    const parsed = parseInviteCode(code);
    const preview = parsed ? await repositories().inviteLinks.preview(parsed, user.id) : null;
    if (!preview) throw new AppError("not_found", "Este link de convite não vale mais. Peça um novo ao mestre.");
    const systems = await systemService.summaries([preview.systemId]);
    return { preview, system: systems.get(preview.systemId)! };
  },

  /** Joins by invite link as a player (the free seats are checked atomically). Returns the campaign id. */
  async joinWithInvite(code: string, user: Pick<UserProfile, "id">): Promise<ID> {
    const parsed = parseInviteCode(code);
    if (!parsed) throw new AppError("validation", "Cole o link de convite que o mestre mandou.");
    return repositories().inviteLinks.join(parsed, user.id);
  },

  async create(cmd: CreateCampaignCommand, owner: Pick<UserProfile, "id" | "displayName">): Promise<Campaign> {
    const errors = validateCreateCampaign(cmd);
    if (Object.keys(errors).length > 0) throw new AppError("validation", Object.values(errors)[0], errors);

    const repo = repositories();
    let systemId: Campaign["systemId"];
    if (cmd.system.kind === "custom") {
      const custom = await repo.systems.saveCustom(owner.id, createCustomSystem(cmd.system.seed));
      systemId = custom.id;
    } else {
      systemId = cmd.system.id;
    }

    const now = new Date().toISOString();
    const campaign = await repo.campaigns.create({
      name: cmd.name.trim(),
      tagline: cmd.tagline.trim(),
      systemId,
      visualStyleId: cmd.visualStyleId,
      status: cmd.firstSession ? "active" : "planning",
      ownerId: owner.id,
      members: [{ userId: owner.id, role: "game_master", characterId: null, joinedAt: now }],
      world: { ...cmd.world, name: cmd.world.name.trim(), premise: cmd.world.premise.trim() },
      gameMaster: { ...cmd.gameMaster, narratorName: cmd.gameMaster.narratorName.trim() || owner.displayName },
      playerPolicy: cmd.playerPolicy,
    });

    // The invite link exists from the start: the GM just shares it.
    await repo.inviteLinks.renew(campaign.id);

    if (cmd.firstSession) {
      await repo.sessions.create({
        campaignId: campaign.id,
        number: 1,
        title: cmd.firstSession.title.trim(),
        status: "scheduled",
        scheduledAt: new Date(cmd.firstSession.scheduledAt).toISOString(),
        durationMinutes: cmd.firstSession.durationMinutes,
        summary: cmd.firstSession.notes.trim(),
        highlights: [],
        attendeeIds: [owner.id],
      });
    }
    return campaign;
  },
};
