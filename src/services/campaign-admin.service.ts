import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { rules } from "@/lib/validation";
import { CAMPAIGN_LIMITS, roleOf } from "./campaign.service";
import type { ID } from "@/types/common";
import type { Campaign, CampaignRole, InviteLink, CampaignStatus, GameMasterPersona, PlayerPolicy, WorldSetup } from "@/types/campaign";
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
    const updated = await repositories().campaigns.update(campaignId, { members: campaign.members.filter((m) => m.userId !== memberId) });
    // The removed person still has the link: a new code keeps them from walking back in.
    if (await repositories().inviteLinks.getForCampaign(campaignId)) await repositories().inviteLinks.renew(campaignId);
    return updated;
  },

  /** The campaign's invite link, or null when it is turned off. */
  async inviteLink(campaignId: ID, user: Actor): Promise<InviteLink | null> {
    await managed(campaignId, user, "campaign:invite");
    return repositories().inviteLinks.getForCampaign(campaignId);
  },

  /** Creates the link, or a new code for it: links already shared stop working. */
  async renewInviteLink(campaignId: ID, user: Actor): Promise<InviteLink> {
    await managed(campaignId, user, "campaign:invite");
    return repositories().inviteLinks.renew(campaignId);
  },

  async disableInviteLink(campaignId: ID, user: Actor): Promise<void> {
    await managed(campaignId, user, "campaign:invite");
    await repositories().inviteLinks.revoke(campaignId);
  },
};
