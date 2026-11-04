import type { MapDocument } from "@/features/map/model/map-document";
import type { ID, Timestamps } from "./common";

/** A map kept in a campaign's library, ready to load into the editor or the table. */
export interface SavedMap extends Timestamps {
  id: ID;
  campaignId: ID;
  name: string;
  createdBy: ID;
  document: MapDocument;
}
