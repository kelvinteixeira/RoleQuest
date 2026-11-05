import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { hasErrors, rules, validate } from "@/lib/validation";
import { createSheet, ensureSheet, summarizeResources } from "@/features/character-sheet/model/sheet";
import { roleOf } from "./campaign.service";
import { systemService } from "./system.service";
import type { ID } from "@/types/common";
import type { Campaign } from "@/types/campaign";
import type { Character, CharacterSheet } from "@/types/character";
import type { SystemId, SystemTemplate } from "@/types/system";
import type { UserProfile } from "@/types/user";

export interface CharacterDraft {
  name: string;
  concept: string;
  systemId: SystemId;
  campaignId: ID | null;
  level: number | null;
  portraitColor: string;
}

/** Everything the sheet editor needs, with permissions already decided. */
export interface EditableCharacter {
  character: Character & { sheet: CharacterSheet };
  system: SystemTemplate;
  campaign: Campaign | null;
  isOwner: boolean;
  canEdit: boolean;
  /** Private notes are hidden from everyone but the owner and the GM. */
  canSeePrivate: boolean;
}

export function validateCharacterDraft(values: CharacterDraft) {
  const errors = validate(values, {
    name: [rules.required("Dê um nome ao personagem."), rules.maxLength(50)],
    concept: [rules.maxLength(80)],
  });
  if (values.level !== null && (!Number.isInteger(values.level) || values.level < 0 || values.level > 99)) {
    (errors as Record<string, string>).level = "Nível entre 0 e 99.";
  }
  return errors as Record<string, string>;
}

async function loadSystem(id: SystemId): Promise<SystemTemplate> {
  const system = await systemService.get(id);
  if (!system) throw new AppError("not_found", "O sistema deste personagem não está disponível.");
  return system;
}

async function access(character: Character, user: Pick<UserProfile, "id">) {
  const campaign = character.campaignId ? await repositories().campaigns.getById(character.campaignId) : null;
  const role = campaign ? roleOf(campaign, user.id) : null;
  const isOwner = character.ownerId === user.id;
  const isGM = can(role, "sheet:edit-any");
  if (!isOwner && !isGM && !can(role, "sheet:view-all")) throw new AppError("forbidden", "Você não tem acesso a esta ficha.");
  const ownerMayEdit = !campaign || campaign.playerPolicy.playersCanEditSheets || role === "game_master";
  return { campaign, isOwner, canEdit: isGM || (isOwner && ownerMayEdit), canSeePrivate: isOwner || isGM };
}

export const characterService = {
  async get(id: ID, user: Pick<UserProfile, "id">): Promise<EditableCharacter> {
    const character = await repositories().characters.getById(id);
    if (!character) throw new AppError("not_found", "Personagem não encontrado.");
    const [system, rights] = await Promise.all([loadSystem(character.systemId), access(character, user)]);
    const sheet = ensureSheet(character, system);
    return {
      character: { ...character, sheet: rights.canSeePrivate ? sheet : { ...sheet, privateNotes: "" } },
      system,
      ...rights,
    };
  },

  async create(draft: CharacterDraft, user: Pick<UserProfile, "id">): Promise<Character> {
    const errors = validateCharacterDraft(draft);
    if (hasErrors(errors)) throw new AppError("validation", Object.values(errors)[0], errors);
    const repo = repositories();
    const system = await loadSystem(draft.systemId);

    let campaign: Campaign | null = null;
    if (draft.campaignId) {
      campaign = await repo.campaigns.getById(draft.campaignId);
      if (!campaign || !roleOf(campaign, user.id)) throw new AppError("forbidden", "Você não participa desta campanha.");
      if (campaign.systemId !== draft.systemId) throw new AppError("validation", "O sistema precisa ser o mesmo da campanha.", { systemId: "O sistema precisa ser o mesmo da campanha." });
    }

    const sheet = createSheet(system);
    const character = await repo.characters.create({
      ownerId: user.id,
      campaignId: draft.campaignId,
      systemId: draft.systemId,
      name: draft.name.trim(),
      concept: draft.concept.trim(),
      level: draft.level,
      portraitColor: draft.portraitColor,
      avatarUrl: null,
      resources: summarizeResources(system, sheet),
      tags: [],
      sheet,
    });

    // A player without a character in this campaign gets this one linked.
    const member = campaign?.members.find((m) => m.userId === user.id);
    if (campaign && member && member.role === "player" && !member.characterId) {
      await repo.campaigns.update(campaign.id, {
        members: campaign.members.map((m) => (m.userId === user.id ? { ...m, characterId: character.id } : m)),
      });
    }
    return character;
  },

  /** Saves identity fields and/or the sheet; keeps the card/token summary in sync. */
  async save(
    id: ID,
    patch: Partial<Pick<Character, "name" | "concept" | "level" | "portraitColor">> & { sheet?: CharacterSheet },
    user: Pick<UserProfile, "id">,
  ): Promise<Character> {
    const repo = repositories();
    const current = await repo.characters.getById(id);
    if (!current) throw new AppError("not_found", "Personagem não encontrado.");
    const rights = await access(current, user);
    if (!rights.canEdit) throw new AppError("forbidden", "Você não pode editar esta ficha.");
    if (patch.name !== undefined && !patch.name.trim()) throw new AppError("validation", "O nome não pode ficar vazio.", { name: "Obrigatório." });

    const system = await loadSystem(current.systemId);
    const sheet = patch.sheet
      ? // Someone without access to private notes must not wipe them.
        { ...patch.sheet, privateNotes: rights.canSeePrivate ? patch.sheet.privateNotes : (current.sheet?.privateNotes ?? "") }
      : undefined;
    return repo.characters.update(id, {
      ...patch,
      ...(sheet ? { sheet, resources: summarizeResources(system, sheet) } : {}),
    });
  },

  async duplicate(id: ID, user: Pick<UserProfile, "id">): Promise<Character> {
    const { character } = await characterService.get(id, user);
    return repositories().characters.create({
      ownerId: user.id,
      campaignId: null,
      systemId: character.systemId,
      name: `${character.name} (cópia)`.slice(0, 50),
      concept: character.concept,
      level: character.level,
      portraitColor: character.portraitColor,
      avatarUrl: character.avatarUrl,
      resources: character.resources,
      tags: character.tags,
      sheet: structuredClone(character.sheet),
    });
  },

  async remove(id: ID, user: Pick<UserProfile, "id">): Promise<void> {
    const character = await repositories().characters.getById(id);
    if (!character) return;
    if (character.ownerId !== user.id) throw new AppError("forbidden", "Só o dono pode excluir o personagem.");
    await repositories().characters.remove(id);
  },

  /** Campaigns the user can attach a new character to. */
  async campaignsForNewCharacter(user: Pick<UserProfile, "id">): Promise<Campaign[]> {
    return repositories().campaigns.listForUser(user.id);
  },
};
