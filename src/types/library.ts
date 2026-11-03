import type { ID, Timestamps } from "./common";
import type { MapBiome, SystemId } from "./system";

export type LibraryAssetKind = "scenario" | "resource";
export type ResourceCategory = "tileset" | "token-pack" | "audio-pack" | "handout";

export interface LibraryAsset extends Timestamps {
  id: ID;
  ownerId: ID;
  kind: LibraryAssetKind;
  title: string;
  description: string;
  /** Scenarios use `biome`; resources use `category`. */
  biome: MapBiome | null;
  category: ResourceCategory | null;
  tags: string[];
  systemIds: SystemId[];
  /** Tiles in a tileset, tracks in an audio pack, rooms in a scenario… */
  itemCount: number;
  previewGradient: [string, string];
}
