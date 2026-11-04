import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { createId } from "@/lib/id";
import { roleOf } from "./campaign.service";
import type { MapDocument } from "@/features/map/model/map-document";
import type { ID } from "@/types/common";
import type { SavedMap } from "@/types/map";
import type { UserProfile } from "@/types/user";

const NAME_MAX = 60;

/** Only the campaign's game master manages its map library. */
async function requireEditor(campaignId: ID, user: Pick<UserProfile, "id">) {
  const campaign = await repositories().campaigns.getById(campaignId);
  if (!campaign) throw new AppError("not_found", "Campanha não encontrada.");
  if (!can(roleOf(campaign, user.id), "map:edit")) throw new AppError("forbidden", "Só o mestre da campanha gerencia os mapas.");
  return campaign;
}

export function validateMapName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Dê um nome ao mapa.";
  if (trimmed.length > NAME_MAX) return `Até ${NAME_MAX} caracteres.`;
  return null;
}

export const mapService = {
  async list(campaignId: ID, user: Pick<UserProfile, "id">): Promise<SavedMap[]> {
    await requireEditor(campaignId, user);
    return repositories().maps.listForCampaign(campaignId);
  },

  /**
   * Saves the document under its own id: saving the same map again updates
   * it. `asCopy` stores it under a new id (the returned document carries it).
   */
  async save(campaignId: ID, user: Pick<UserProfile, "id">, document: MapDocument, options: { asCopy?: boolean } = {}): Promise<SavedMap> {
    await requireEditor(campaignId, user);
    const error = validateMapName(document.name);
    if (error) throw new AppError("validation", error, { name: error });
    const doc: MapDocument = options.asCopy ? { ...document, id: createId("map"), name: `${document.name.trim()} (cópia)`.slice(0, NAME_MAX) } : { ...document, name: document.name.trim() };
    const existing = await repositories().maps.getById(doc.id);
    // Ids are global; never overwrite a map that belongs to another campaign.
    if (existing && existing.campaignId !== campaignId) return mapService.save(campaignId, user, document, { asCopy: true });
    return repositories().maps.save({ id: doc.id, campaignId, name: doc.name, createdBy: existing?.createdBy ?? user.id, document: doc });
  },

  async remove(campaignId: ID, user: Pick<UserProfile, "id">, mapId: ID): Promise<void> {
    await requireEditor(campaignId, user);
    const existing = await repositories().maps.getById(mapId);
    if (!existing || existing.campaignId !== campaignId) throw new AppError("not_found", "Mapa não encontrado.");
    await repositories().maps.remove(mapId);
  },
};
