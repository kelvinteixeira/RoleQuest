import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { rules } from "@/lib/validation";
import { CAMPAIGN_LIMITS, roleOf } from "./campaign.service";
import type { ID } from "@/types/common";
import type { Campaign, CampaignInvite, CampaignRole, CampaignStatus, GameMasterPersona, PlayerPolicy, WorldSetup } from "@/types/campaign";
import type { UserProfile } from "@/types/user";
import { NARRATION_STYLES } from "@/constants/campaign";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["planning", "active", "paused", "completed"];

type Actor = Pick<UserProfile, "id" | "displayName">;

export interface CampaignSettings {
  name: string;
  tagline: string;
  status: CampaignStatus;
  world: WorldSetup;
  gameMaster: GameMasterPersona;
  playerPolicy: PlayerPolicy;
}

async function managed(campaignId: ID, user: Actor, capability: "campaign:manage" | "campaign:invite" = "campaign:manage"): Promise<Campaign> {
  const campaign = await repositories().campaigns.getById(campaignId);
  if (!campaign) throw new AppError("not_found", "Campanha não encontrada.");
  if (!can(roleOf(campaign, user.id), capability)) throw new AppError("forbidden", "Só o mestre da campanha pode fazer isso.");
  return campaign;
}

const players = (c: Campaign) => c.members.filter((m) => m.role === "player").length;

/** Field errors for the settings form (dotted paths). */
export function validateSettings(s: CampaignSettings, currentPlayers: number): Record<string, string> {
  const e: Record<string, string> = {};
  const check = (key: string, message: string | null) => {
    if (message && !e[key]) e[key] = message;
  };
  check("name", rules.required("Dê um nome à campanha.")(s.name));
  check("name", rules.minLength(CAMPAIGN_LIMITS.nameMin)(s.name));
  check("name", rules.maxLength(CAMPAIGN_LIMITS.nameMax)(s.name));
  check("tagline", rules.maxLength(160)(s.tagline));
  check("world.name", rules.maxLength(60)(s.world.name));
  check("world.premise", rules.maxLength(600)(s.world.premise));
  check("world.startingLocation", rules.maxLength(80)(s.world.startingLocation));
  check("gameMaster.narratorName", rules.maxLength(40)(s.gameMaster.narratorName));
  check("gameMaster.notes", rules.maxLength(1000)(s.gameMaster.notes));
  const max = s.playerPolicy.maxPlayers;
  if (!Number.isInteger(max) || max < 1 || max > CAMPAIGN_LIMITS.maxPlayers) e["playerPolicy.maxPlayers"] = `Entre 1 e ${CAMPAIGN_LIMITS.maxPlayers} jogadores.`;
  else if (max < currentPlayers) e["playerPolicy.maxPlayers"] = `Já há ${currentPlayers} jogadores na mesa; remova alguém antes de reduzir as vagas.`;
  if (s.world.tone.length > 8) e["world.tone"] = "No máximo 8 tons.";
  if (!CAMPAIGN_STATUSES.includes(s.status)) e.status = "Situação inválida.";
  if (!NARRATION_STYLES.some((n) => n.id === s.gameMaster.narrationStyle)) e["gameMaster.narrationStyle"] = "Estilo inválido.";
  return e;
}

/**
 * Campaign administration for the GM: settings and table rules, members
 * (roles, removal) and invites. The owner always stays a GM, and a campaign
 * always keeps at least one GM.
 */
export const campaignAdminService = {
  async updateSettings(campaignId: ID, user: Actor, settings: CampaignSettings): Promise<Campaign> {
    const campaign = await managed(campaignId, user);
    const errors = validateSettings(settings, players(campaign));
    if (Object.keys(errors).length) throw new AppError("validation", Object.values(errors)[0], errors);
    // Only known fields are stored (whatever else the caller sends is dropped).
    const { world, gameMaster, playerPolicy } = settings;
    return repositories().campaigns.update(campaignId, {
      name: settings.name.trim(),
      tagline: settings.tagline.trim(),
      status: settings.status,
      world: { name: world.name.trim(), premise: world.premise.trim(), startingLocation: world.startingLocation.trim(), tone: world.tone.map((t) => t.trim()).filter(Boolean) },
      gameMaster: { narratorName: gameMaster.narratorName.trim() || user.displayName, narrationStyle: gameMaster.narrationStyle, notes: gameMaster.notes.trim() },
      playerPolicy: {
        maxPlayers: playerPolicy.maxPlayers,
        playersCanEditSheets: !!playerPolicy.playersCanEditSheets,
        playersCanMoveOwnToken: !!playerPolicy.playersCanMoveOwnToken,
        allowPrivateMessages: !!playerPolicy.allowPrivateMessages,
        rollsPublicByDefault: !!playerPolicy.rollsPublicByDefault,
      },
    });
  },

  /** Only the campaign's creator changes roles (co-GMs can't promote or demote each other). */
  async setMemberRole(campaignId: ID, user: Actor, memberId: ID, role: CampaignRole): Promise<Campaign> {
    const campaign = await managed(campaignId, user);
    if (user.id !== campaign.ownerId) throw new AppError("forbidden", "Só quem criou a campanha muda os papéis.");
    const member = campaign.members.find((m) => m.userId === memberId);
    if (!member) throw new AppError("not_found", "Participante não encontrado.");
    if (member.role === role) return campaign;
    if (memberId === campaign.ownerId && role !== "game_master") throw new AppError("validation", "Quem criou a campanha continua mestre.");
    if (role === "player" && campaign.members.filter((m) => m.role === "game_master").length <= 1) throw new AppError("validation", "A campanha precisa de pelo menos um mestre.");
    if (role === "player" && players(campaign) >= campaign.playerPolicy.maxPlayers) throw new AppError("validation", "Não há vaga de jogador. Aumente o limite nas regras da mesa.");
    return repositories().campaigns.update(campaignId, { members: campaign.members.map((m) => (m.userId === memberId ? { ...m, role } : m)) });
  },

  /** Removes a member; their character stays theirs but leaves the campaign. */
  async removeMember(campaignId: ID, user: Actor, memberId: ID): Promise<Campaign> {
    const campaign = await managed(campaignId, user);
    const member = campaign.members.find((m) => m.userId === memberId);
    if (!member) throw new AppError("not_found", "Participante não encontrado.");
    if (memberId === campaign.ownerId) throw new AppError("validation", "Quem criou a campanha não pode ser removido.");
    if (memberId === user.id) throw new AppError("validation", "Para sair da campanha, peça a quem a criou.");
    if (member.role === "game_master" && user.id !== campaign.ownerId) throw new AppError("forbidden", "Só quem criou a campanha remove outros mestres.");
    if (member.role === "game_master" && campaign.members.filter((m) => m.role === "game_master").length <= 1) throw new AppError("validation", "A campanha precisa de pelo menos um mestre.");
    if (member.characterId) {
      const character = await repositories().characters.getById(member.characterId);
      if (character?.campaignId === campaignId) await repositories().characters.update(character.id, { campaignId: null });
    }
    return repositories().campaigns.update(campaignId, { members: campaign.members.filter((m) => m.userId !== memberId) });
  },

  async listInvites(campaignId: ID, user: Actor): Promise<CampaignInvite[]> {
    await managed(campaignId, user, "campaign:invite");
    return (await repositories().invites.listForCampaign(campaignId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Invites by e-mail. Skips addresses with a pending invite; refuses more pending invites than free seats. */
  async invite(campaignId: ID, user: Actor, emails: string[], message: string): Promise<CampaignInvite[]> {
    const campaign = await managed(campaignId, user, "campaign:invite");
    const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) throw new AppError("validation", "Informe pelo menos um e-mail.", { emails: "Informe pelo menos um e-mail." });
    const invalid = unique.find((e) => rules.email()(e));
    if (invalid) throw new AppError("validation", `E-mail inválido: ${invalid}`, { emails: `E-mail inválido: ${invalid}` });
    if (message.trim().length > 400) throw new AppError("validation", "Mensagem de até 400 caracteres.", { message: "Mensagem de até 400 caracteres." });

    const existing = await repositories().invites.listForCampaign(campaignId);
    const pending = new Set(existing.filter((i) => i.status === "pending").map((i) => i.email));
    // People already at the table don't need (or take a seat with) an invite.
    const memberEmails = new Set((await repositories().users.getMany(campaign.members.map((m) => m.userId))).map((p) => p.email.toLowerCase()));
    const fresh = unique.filter((e) => !pending.has(e) && !memberEmails.has(e));
    const seats = campaign.playerPolicy.maxPlayers - players(campaign) - pending.size;
    if (fresh.length > seats) {
      const msg = seats <= 0 ? "Não há vagas livres para novos convites." : `Só há ${seats} vaga(s) livre(s) contando os convites pendentes.`;
      throw new AppError("validation", msg, { emails: msg });
    }
    return Promise.all(
      fresh.map((email) =>
        repositories().invites.create({ campaignId, campaignName: campaign.name, systemId: campaign.systemId, invitedById: user.id, invitedByName: user.displayName, email, message: message.trim() }),
      ),
    );
  },

  async revokeInvite(campaignId: ID, user: Actor, inviteId: ID): Promise<CampaignInvite> {
    await managed(campaignId, user, "campaign:invite");
    const invite = await repositories().invites.getById(inviteId);
    if (!invite || invite.campaignId !== campaignId) throw new AppError("not_found", "Convite não encontrado.");
    if (invite.status !== "pending") throw new AppError("validation", "Só convites pendentes podem ser cancelados.");
    return repositories().invites.updateStatus(inviteId, "revoked");
  },
};
