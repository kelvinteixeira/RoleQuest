import type { ID, Timestamps } from "./common";
import type { SystemId } from "./system";

export interface CharacterResourceValue {
  key: string;
  label: string;
  current: number;
  max: number;
  color: string;
}

export interface SheetItem {
  id: ID;
  name: string;
  quantity: number;
  /** Weight per unit (kg) or slots, depending on the system inventory model. */
  weight: number;
  equipped: boolean;
  slot: string | null;
  notes: string;
}

export interface SheetAbility {
  id: ID;
  name: string;
  /** Free label: "Magia", "Talento", "Disciplina"… */
  kind: string;
  cost: string;
  description: string;
}

export type CustomFieldValue = string | number | boolean | string[];

/**
 * Editable sheet. Keys follow the system template (attribute/resource/skill
 * keys), so a template change never loses data: unknown keys are kept.
 */
export interface CharacterSheet {
  attributes: Record<string, number>;
  resources: Record<string, { current: number; max: number }>;
  /** `attribute` overrides the template link (systems whose skills combine with a chosen attribute). */
  skills: Record<string, { trained: boolean; bonus: number; attribute?: string }>;
  abilities: SheetAbility[];
  inventory: SheetItem[];
  currency: Record<string, number>;
  custom: Record<string, CustomFieldValue>;
  conditions: string[];
  story: { background: string; personality: string; appearance: string; relationships: string; history: string };
  /** Visible to the owner and the game master only. */
  privateNotes: string;
}

/**
 * Character as shown in lists, dashboards and tokens, plus its sheet.
 * `resources` is a denormalised summary of the sheet for cards and tokens.
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
  /** Missing on records created before sheets existed; the service fills defaults. */
  sheet?: CharacterSheet;
}

export type NewCharacterInput = Omit<Character, "id" | "createdAt" | "updatedAt">;
