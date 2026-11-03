/**
 * RPG system templates describe STRUCTURE only (fields, dice, resources, rules
 * toggles). They never contain text reproduced from commercial rulebooks.
 */

export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export const DIE_TYPES: readonly DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

export type BuiltInSystemId =
  | "dnd5e"
  | "pathfinder2e"
  | "call-of-cthulhu"
  | "vampire-masquerade"
  | "werewolf-apocalypse"
  | "tormenta20"
  | "3dt-victory"
  | "ordem-paranormal"
  | "cyberpunk-red"
  | "gurps";

export type CustomSystemId = `custom_${string}`;
export type SystemId = BuiltInSystemId | CustomSystemId;

/** How a check is resolved. Drives the dice roller in Phase 3. */
export type ResolutionMechanic =
  | "d20-plus-modifier"
  | "d100-roll-under"
  | "d10-dice-pool"
  | "d20-pool-keep-highest"
  | "d6-plus-attribute"
  | "d10-plus-stat-skill"
  | "3d6-roll-under"
  | "custom";

export type SystemGlyph = "sword" | "shield" | "eye" | "droplet" | "moon" | "flame" | "star" | "ghost" | "cpu" | "dices" | "sparkles";

export interface SystemTheme {
  /** CSS color, exposed as --system-accent within system-scoped UI. */
  accent: string;
  glyph: SystemGlyph;
  /** Two-stop gradient used on cards and campaign covers. */
  gradient: [string, string];
}

export interface AttributeDefinition {
  key: string;
  label: string;
  abbreviation: string;
  min: number;
  max: number;
  defaultValue: number;
  /** Roll formula with `@value` / `@mod` placeholders, e.g. "1d20 + @mod". */
  rollFormula?: string;
  group?: string;
}

export interface ResourceDefinition {
  key: string;
  label: string;
  color: string;
  defaultMax: number;
  /** Human-readable derivation (e.g. "CON + nível"). Evaluated by the sheet engine in Phase 2. */
  derivedFrom?: string;
  /** Shown as a bar on map tokens. */
  showOnToken: boolean;
}

export interface SkillDefinition {
  key: string;
  label: string;
  attributeKey?: string;
}

export interface ConditionDefinition {
  key: string;
  label: string;
  description: string;
}

export interface DiceConfig {
  primaryDie: DieType;
  mechanic: ResolutionMechanic;
  defaultFormula: string;
  supportsAdvantage: boolean;
  criticalRule?: string;
  notes: string;
}

export interface CombatConfig {
  initiativeFormula: string;
  defenseLabel: string;
  actionEconomy: string[];
  distanceUnit: "ft" | "m" | "squares";
  /** Real-world distance represented by one grid square. */
  gridCellDistance: number;
}

export interface InventoryConfig {
  model: "weight" | "slots" | "list";
  capacityLabel: string;
  currencies: string[];
  equipmentSlots: string[];
}

export type CustomFieldType = "text" | "textarea" | "number" | "counter" | "select" | "checkbox" | "list";

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  section: string;
  options?: string[];
}

export interface RuleToggle {
  key: string;
  label: string;
  description: string;
  enabledByDefault: boolean;
}

export interface ProgressionConfig {
  model: "levels" | "experience-points" | "milestones" | "character-points";
  label: string;
  max?: number;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  tone: string[];
}

export type MapBiome =
  | "forest"
  | "castle"
  | "dungeon"
  | "city"
  | "village"
  | "cave"
  | "interior"
  | "futuristic"
  | "supernatural"
  | "wilderness";

export interface MapTemplate {
  id: string;
  name: string;
  biome: MapBiome;
  columns: number;
  rows: number;
}

export interface SystemTemplate {
  id: SystemId;
  kind: "builtin" | "custom";
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  genres: string[];
  /** Legal footing for the structure we provide. */
  licensing: { basis: "open-license" | "compatibility" | "original"; note: string };
  theme: SystemTheme;
  dice: DiceConfig;
  attributes: AttributeDefinition[];
  resources: ResourceDefinition[];
  skills: SkillDefinition[];
  abilitiesLabel: string;
  conditions: ConditionDefinition[];
  combat: CombatConfig;
  inventory: InventoryConfig;
  progression: ProgressionConfig;
  customFields: CustomFieldDefinition[];
  rules: RuleToggle[];
  campaignTemplates: CampaignTemplate[];
  mapTemplates: MapTemplate[];
}
