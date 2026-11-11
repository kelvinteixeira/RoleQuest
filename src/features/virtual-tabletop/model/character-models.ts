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
  group: "hero" | "undead" | "creature" | "monster";
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
  /** Squares per side a creature with this body takes unless its token says otherwise (2 = large, 3 = huge). */
  size?: number;
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

/* Monsters: Ultimate Monsters Bundle by Quaternius. Three rigs share their animation names. */
const BLOB_RIG: CharacterModel["animations"] = { idle: "Idle", walk: "Walk", attack: "Bite_Front", cast: "Bite_Front", hit: "HitRecieve", death: "Death", cheer: "Dance" };
const FLYER_RIG: CharacterModel["animations"] = { idle: "Flying_Idle", walk: "Fast_Flying", attack: "Headbutt", cast: "Punch", hit: "HitReact", death: "Death" };
const BIPED_RIG: CharacterModel["animations"] = { idle: "Idle", walk: "Walk", attack: "Punch", cast: "Weapon", hit: "HitReact", death: "Death", cheer: "Wave" };

const monster = (id: string, label: string, height: number, animations: CharacterModel["animations"], extra: Partial<CharacterModel> = {}): CharacterModel => ({
  id,
  label,
  group: "monster",
  file: `${base}monsters/${id}.glb`,
  height,
  hide: [],
  animations,
  ...extra,
});

export const MONSTER_MODELS: readonly CharacterModel[] = [
  monster("pink-slime", "Slime rosa", 0.5, BLOB_RIG),
  monster("green-blob", "Gosma verde", 0.55, BLOB_RIG),
  monster("green-spiky-blob", "Gosma espinhosa", 0.75, BLOB_RIG),
  monster("mushnub", "Cogumelo", 0.6, BLOB_RIG),
  monster("mushnub-evolved", "Cogumelo ancião", 0.85, BLOB_RIG),
  monster("mushroom-king", "Rei Cogumelo", 1, BIPED_RIG, { size: 2 }),
  monster("frog", "Homem-sapo", 0.9, BIPED_RIG),
  monster("cactoro", "Cacto vivo", 0.8, BLOB_RIG),
  monster("cactoro-big", "Cacto guerreiro", 1.05, BIPED_RIG),
  monster("armabee", "Abelha blindada", 0.6, FLYER_RIG),
  monster("armabee-evolved", "Vespa rainha", 0.8, FLYER_RIG),
  monster("squidle", "Lula flutuante", 0.7, FLYER_RIG),
  monster("glub", "Peixe-diabo", 0.65, FLYER_RIG),
  monster("glub-evolved", "Peixe-diabo ancião", 0.95, FLYER_RIG),
  monster("hywirl", "Elemental do vento", 0.95, FLYER_RIG),
  monster("ghost", "Fantasma", 0.95, FLYER_RIG),
  monster("ghost-skull", "Espectro caveira", 1, FLYER_RIG),
  monster("tribal", "Espírito tribal", 1, FLYER_RIG),
  monster("wizard", "Bruxo", 0.9, BLOB_RIG),
  monster("orc-enemy", "Orc batedor", 0.9, BLOB_RIG),
  monster("orc", "Orc guerreiro", 1.1, BIPED_RIG),
  monster("goleling", "Golem menor", 0.7, FLYER_RIG),
  monster("goleling-evolved", "Golem", 0.95, FLYER_RIG, { size: 2 }),
  monster("yeti", "Yeti filhote", 0.8, BLOB_RIG),
  monster("yeti-big", "Yeti", 1, BIPED_RIG, { size: 2 }),
  monster("demon", "Diabrete", 0.7, FLYER_RIG),
  monster("demon-big", "Demônio", 1, BIPED_RIG, { size: 2 }),
  monster("blue-demon", "Demônio azul", 1, BIPED_RIG, { size: 2 }),
  monster("dino", "Dinossauro", 1.1, BIPED_RIG),
  monster("monkroose", "Fera chifruda", 1.1, BIPED_RIG),
  monster("dragon", "Dragão jovem", 0.85, FLYER_RIG, { size: 2 }),
  monster("dragon-evolved", "Dragão", 0.9, FLYER_RIG, { size: 3 }),
];

export const ALL_CHARACTER_MODELS: readonly CharacterModel[] = [...CHARACTER_MODELS, ...MONSTER_MODELS];

export const CHARACTER_MODEL_BY_ID = new Map(ALL_CHARACTER_MODELS.map((m) => [m.id, m]));

export const CHARACTER_GROUP_LABEL: Record<CharacterModel["group"], string> = {
  hero: "Heróis",
  undead: "Mortos-vivos",
  creature: "Criaturas",
  monster: "Monstros",
};

/** Best guess from the token's concept until the GM picks a model. */
export function defaultModelId(token: Pick<RoomToken, "kind" | "concept" | "name">): string {
  const text = `${token.concept} ${token.name}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/dragão|dragao|wyrm/, "dragon-evolved"],
    [/slime|gosma|geleia/, "pink-slime"],
    [/golem|constructo/, "goleling-evolved"],
    [/demôni|demoni|diabo/, "demon-big"],
    [/fantasma|espectro|assombra/, "ghost"],
    [/orc|ogro|troll|goblin/, "orc"],
    [/yeti|gigante/, "yeti-big"],
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

export const SIZE_LABEL: Record<number, string> = { 1: "Médio (1×1)", 2: "Grande (2×2)", 3: "Enorme (3×3)", 4: "Colossal (4×4)" };
export const MAX_TOKEN_SIZE = 4;

/** Squares per side a token takes: its own size, else its body's, else one. */
export function sizeOf(token: Pick<RoomToken, "size" | "modelId">): number {
  const size = token.size ?? CHARACTER_MODEL_BY_ID.get(token.modelId ?? "")?.size ?? 1;
  return Math.max(1, Math.min(MAX_TOKEN_SIZE, Math.round(size)));
}

export function modelFor(token: RoomToken): CharacterModel {
  return CHARACTER_MODEL_BY_ID.get(token.modelId ?? "") ?? CHARACTER_MODEL_BY_ID.get(defaultModelId(token))!;
}
