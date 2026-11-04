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

/** A weapon or attack on the sheet. The room turns it into a to-hit value with the system's mechanic. */
export interface SheetAttack {
  id: ID;
  name: string;
  attributeKey: string | null;
  skillKey: string | null;
  /** d20 systems without weapon skills: adds the proficiency bonus. */
  proficient: boolean;
  /** Extra to-hit bonus (magic weapon, aim, house rule). */
  bonus: number;
  /** "1d8+@mod", "2d6", "1" — `@mod`/`@value` are the attack attribute's modifier/value. */
  damage: string;
  /** Reach in squares; 1 = melee. */
  range: number;
}

export interface SheetCombat {
  /** null = derived from attributes (see `deriveDefense`). */
  defense: number | null;
  /** Damage reduction (armor SP, DR). */
  armor: number;
  /** Squares per turn. */
  speed: number;
  attacks: SheetAttack[];
}

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
  combat: SheetCombat;
  conditions: string[];
  story: { background: string; personality: string; appearance: string; relationships: string; history: string };
  /** Visible to the owner and the game master only. */
  privateNotes: string;
  /** Class of a custom system (see SystemTemplate.classes). */
  classKey?: string;
  /** Resource bonus the class gave when chosen (undone exactly on a switch). */
  classBonus?: Record<string, number>;
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
