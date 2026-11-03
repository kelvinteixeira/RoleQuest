import type { ID, Timestamps } from "./common";
import type { SystemId } from "./system";

export interface CharacterResourceValue {
  key: string;
  label: string;
  current: number;
  max: number;
  color: string;
}

/**
 * Character as shown in lists, dashboards and tokens.
 * The full configurable sheet (attributes, skills, inventory…) is added in Phase 2.
 */
export interface Character extends Timestamps {
  id: ID;
  ownerId: ID;
  campaignId: ID | null;
  systemId: SystemId;
  name: string;
  /** One-line concept: ancestry, class, role ("Elfa, Ladina das Docas"). */
  concept: string;
  level: number | null;
  portraitColor: string;
  avatarUrl: string | null;
  resources: CharacterResourceValue[];
  tags: string[];
}
