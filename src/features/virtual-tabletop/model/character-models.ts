/**
 * 3D models available for tokens. A model is a GLB plus a "loadout" (which
 * attached meshes stay visible), an animation map and an optional tint, so
 * one file can serve several classes (archer and assassin share rogue-hooded).
 */
import type { RoomToken } from "./types";

export type AnimationRole = "idle" | "walk" | "attack" | "cast" | "hit" | "death" | "cheer";

export interface CharacterModel {
  id: string;
  label: string;
  group: "hero" | "undead" | "creature";
  file: string;
  /** Height in cells the model is scaled to. */
  height: number;
  /** Also cap the widest horizontal extent (wide creatures like bats). */
  maxWidth?: number;
  /** Mesh names to hide (weapons/props not used by this class). */
  hide: string[];
  animations: Partial<Record<AnimationRole, string>>;
  /** Multiplies material colours (e.g. a pale vampire). */
  tint?: string;
  /** Hover above the ground (flying creatures). */
  hover?: number;
}

const KAYKIT_BASE: CharacterModel["animations"] = {
  idle: "Idle",
  walk: "Walking_A",
  attack: "1H_Melee_Attack_Chop",
  cast: "Spellcast_Raise",
  hit: "Hit_A",
  death: "Death_A",
  cheer: "Cheer",
};

const KNIGHT_SPARE = ["1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Spike_Shield", "2H_Sword"];
const BARBARIAN_SPARE = ["1H_Axe_Offhand", "Barbarian_Round_Shield", "1H_Axe", "Mug"];
const MAGE_SPARE = ["Spellbook", "Spellbook_open", "1H_Wand"];
const ROGUE_BLADES = ["Knife", "Knife_Offhand"];
const ROGUE_RANGED = ["1H_Crossbow", "2H_Crossbow"];

const base = "/assets/characters/";

export const CHARACTER_MODELS: readonly CharacterModel[] = [
  { id: "warrior", label: "Guerreiro", group: "hero", file: `${base}knight.glb`, height: 1, hide: KNIGHT_SPARE, animations: KAYKIT_BASE },
  {
    id: "barbarian",
    label: "Bárbaro",
    group: "hero",
    file: `${base}barbarian.glb`,
    height: 1,
    hide: BARBARIAN_SPARE,
    animations: { ...KAYKIT_BASE, idle: "2H_Melee_Idle", attack: "2H_Melee_Attack_Chop" },
  },
  { id: "mage", label: "Mago", group: "hero", file: `${base}mage.glb`, height: 1, hide: MAGE_SPARE, animations: { ...KAYKIT_BASE, attack: "Spellcast_Shoot" } },
  {
    id: "assassin",
    label: "Assassino",
    group: "hero",
    file: `${base}rogue-hooded.glb`,
    height: 1,
    hide: [...ROGUE_RANGED, "Throwable"],
    animations: { ...KAYKIT_BASE, attack: "Dualwield_Melee_Attack_Stab" },
  },
  {
    id: "archer",
    label: "Arqueiro",
    group: "hero",
    file: `${base}rogue.glb`,
    height: 1,
    hide: [...ROGUE_BLADES, "1H_Crossbow", "Throwable"],
    animations: { ...KAYKIT_BASE, attack: "2H_Ranged_Shoot" },
  },
  {
    id: "vampire",
    label: "Vampiro",
    group: "creature",
    file: `${base}mage.glb`,
    height: 1.05,
    hide: [...MAGE_SPARE, "2H_Staff", "Mage_Hat"],
    animations: { ...KAYKIT_BASE, attack: "Spellcast_Shoot" },
    tint: "#b8a3c9",
  },
  { id: "skeleton-warrior", label: "Esqueleto guerreiro", group: "undead", file: `${base}skeleton-warrior.glb`, height: 1, hide: [], animations: KAYKIT_BASE },
  { id: "skeleton-rogue", label: "Esqueleto ladino", group: "undead", file: `${base}skeleton-rogue.glb`, height: 1, hide: [], animations: { ...KAYKIT_BASE, attack: "Dualwield_Melee_Attack_Stab" } },
  { id: "skeleton-mage", label: "Necromante", group: "undead", file: `${base}skeleton-mage.glb`, height: 1.05, hide: [], animations: { ...KAYKIT_BASE, attack: "Spellcast_Shoot" } },
  { id: "skeleton-minion", label: "Lacaio esqueleto", group: "undead", file: `${base}skeleton-minion.glb`, height: 0.85, hide: [], animations: KAYKIT_BASE },
  {
    id: "vampire-bat",
    label: "Morcego-vampiro",
    group: "creature",
    file: `${base}vampire-bat.glb`,
    height: 0.45,
    maxWidth: 0.95,
    hover: 0.55,
    hide: [],
    animations: { idle: "Bat_Flying", walk: "Bat_Flying", attack: "Bat_Attack", hit: "Bat_Attack", death: "Bat_Die" },
  },
  {
    id: "frost-bat",
    label: "Morcego de gelo",
    group: "creature",
    file: `${base}frost-bat.glb`,
    height: 0.45,
    maxWidth: 0.95,
    hover: 0.55,
    hide: [],
    animations: { idle: "Bat_Flying", walk: "Bat_Flying", attack: "Bat_Attack", hit: "Bat_Attack", death: "Bat_Die" },
  },
  { id: "wolf", label: "Lobo", group: "creature", file: `${base}wolf.glb`, height: 0.55, hide: [], animations: {} },
  { id: "werewolf", label: "Lobisomem", group: "creature", file: `${base}wolf.glb`, height: 0.85, hide: [], animations: {}, tint: "#5a4636" },
];

export const CHARACTER_MODEL_BY_ID = new Map(CHARACTER_MODELS.map((m) => [m.id, m]));

export const CHARACTER_GROUP_LABEL: Record<CharacterModel["group"], string> = {
  hero: "Heróis",
  undead: "Mortos-vivos",
  creature: "Criaturas",
};

/** Best guess from the token's concept until the GM picks a model. */
export function defaultModelId(token: Pick<RoomToken, "kind" | "concept" | "name">): string {
  const text = `${token.concept} ${token.name}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/vampir/, "vampire"],
    [/lobisom|licantrop/, "werewolf"],
    [/morcego/, "vampire-bat"],
    [/lobo/, "wolf"],
    [/necromant|lich/, "skeleton-mage"],
    [/esquelet|morto-vivo/, "skeleton-warrior"],
    [/mag|feiti|bruxa|clérig|ocultist|sacerdot/, "mage"],
    [/arque|patrulh|caçador|atirador/, "archer"],
    [/ladin|assassin|furtiv/, "assassin"],
    [/bárbar|anão|berserk/, "barbarian"],
  ];
  for (const [re, id] of rules) if (re.test(text)) return id;
  return token.kind === "enemy" ? "skeleton-warrior" : "warrior";
}

export function modelFor(token: RoomToken): CharacterModel {
  return CHARACTER_MODEL_BY_ID.get(token.modelId ?? "") ?? CHARACTER_MODEL_BY_ID.get(defaultModelId(token))!;
}
