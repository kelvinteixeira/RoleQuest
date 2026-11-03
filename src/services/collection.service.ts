/**
 * Read models for the user's personal collections: characters and library assets.
 */
import { repositories } from "@/repositories";
import { systemService, type SystemSummary } from "./system.service";
import type { ID } from "@/types/common";
import type { Character } from "@/types/character";
import type { LibraryAsset } from "@/types/library";

export interface CharacterCardModel {
  character: Character;
  system: SystemSummary;
  campaignName: string | null;
}

export const collectionService = {
  async listCharacters(userId: ID): Promise<CharacterCardModel[]> {
    const repo = repositories();
    const characters = await repo.characters.listForUser(userId);
    const [systems, campaigns] = await Promise.all([
      systemService.summaries(characters.map((c) => c.systemId)),
      repo.campaigns.listForUser(userId),
    ]);
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
    return characters
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((character) => ({
        character,
        system: systems.get(character.systemId)!,
        campaignName: character.campaignId ? (campaignName.get(character.campaignId) ?? null) : null,
      }));
  },

  async listLibrary(userId: ID): Promise<LibraryAsset[]> {
    const assets = await repositories().library.listForUser(userId);
    return assets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
