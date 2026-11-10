/**
 * Characters the GM can drop on a map without preparing an NPC first:
 * townsfolk for villages and castles, creatures for dungeons and woods.
 * Stats are d20 terms (re-derived for the room's system when they become tokens).
 */
import type { SpawnTemplate } from "@/features/map/model/map-document";
import { defaultModelId } from "@/features/virtual-tabletop/model/character-models";
import type { Npc, NpcAttitude } from "@/types/gm";

export const ATTITUDE_COLOR: Record<NpcAttitude, string> = {
  ally: "oklch(0.66 0.15 150)",
  neutral: "oklch(0.75 0.12 85)",
  hostile: "oklch(0.55 0.19 25)",
};

/** Plain hex for the 3D markers (three.js does not parse oklch). */
export const ATTITUDE_HEX: Record<NpcAttitude, string> = { ally: "#4ade80", neutral: "#facc15", hostile: "#ef4444" };

export type MonsterTier = "small" | "medium" | "large" | "huge" | "colossal";

export interface SpawnPreset extends SpawnTemplate {
  key: string;
  group: "people" | "creatures" | "monsters";
  /** Monsters only: how big it is (the bestiary is listed by tier). */
  tier?: MonsterTier;
}

export const TIER_LABEL: Record<MonsterTier, string> = {
  small: "Pequenos",
  medium: "Médios",
  large: "Grandes · 2×2",
  huge: "Enormes · 3×3",
  colossal: "Colossais · 4×4",
};
export const TIER_ORDER: MonsterTier[] = ["small", "medium", "large", "huge", "colossal"];
const TIER_SIZE: Record<MonsterTier, number> = { small: 1, medium: 1, large: 2, huge: 3, colossal: 4 };

const preset = (key: string, group: SpawnPreset["group"], name: string, concept: string, modelId: string, attitude: NpcAttitude, stats: SpawnTemplate["stats"]): SpawnPreset => ({
  key,
  group,
  name,
  concept,
  modelId,
  attitude,
  color: ATTITUDE_COLOR[attitude],
  stats,
});

export const SPAWN_PRESETS: readonly SpawnPreset[] = [
  preset("guard", "people", "Guarda", "Humano · guarda da cidade", "warrior", "ally", { hp: 16, defense: 15, attackBonus: 4, damage: "1d8+2", speed: 6, initiativeBonus: 1, attackName: "Lança" }),
  preset("villager", "people", "Aldeão", "Humano · gente do povo", "barbarian", "neutral", { hp: 6, defense: 10, attackBonus: 1, damage: "1d4", speed: 6, initiativeBonus: 0, attackName: "Porrete" }),
  preset("innkeeper", "people", "Taverneiro", "Humano · dono da taverna", "barbarian", "neutral", { hp: 9, defense: 11, attackBonus: 2, damage: "1d6", speed: 6, initiativeBonus: 0, attackName: "Caneca" }),
  preset("priest", "people", "Sacerdote", "Humano · servo do templo", "mage", "ally", { hp: 12, defense: 12, attackBonus: 3, damage: "1d6+1", speed: 6, initiativeBonus: 0, attackName: "Chama sagrada", range: 6 }),
  preset("hunter", "people", "Caçador", "Humano · batedor da floresta", "archer", "neutral", { hp: 12, defense: 13, attackBonus: 4, damage: "1d8+1", speed: 7, initiativeBonus: 2, attackName: "Arco longo", range: 8 }),
  preset("bandit", "people", "Bandido", "Humano · salteador de estrada", "assassin", "hostile", { hp: 11, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2, attackName: "Adaga" }),
  preset("black-knight", "people", "Cavaleiro negro", "Humano · campeão sombrio", "warrior", "hostile", { hp: 32, defense: 17, attackBonus: 6, damage: "1d10+3", speed: 5, initiativeBonus: 0, attackName: "Montante" }),
  preset("wolf", "creatures", "Lobo", "Fera · caça em matilha", "wolf", "hostile", { hp: 11, defense: 13, attackBonus: 4, damage: "2d4+2", speed: 8, initiativeBonus: 2, attackName: "Mordida" }),
  preset("werewolf", "creatures", "Lobisomem", "Licantropo · fúria na lua cheia", "werewolf", "hostile", { hp: 45, defense: 14, attackBonus: 6, damage: "2d6+3", speed: 8, initiativeBonus: 2, attackName: "Garras" }),
  preset("skeleton", "creatures", "Esqueleto guerreiro", "Morto-vivo · espada enferrujada", "skeleton-warrior", "hostile", { hp: 13, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2, attackName: "Espada enferrujada" }),
  preset("skeleton-rogue", "creatures", "Esqueleto ladino", "Morto-vivo · lâminas gêmeas", "skeleton-rogue", "hostile", { hp: 12, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 7, initiativeBonus: 3, attackName: "Adagas" }),
  preset("minion", "creatures", "Lacaio esqueleto", "Morto-vivo · fraco, mas em bando", "skeleton-minion", "hostile", { hp: 7, defense: 11, attackBonus: 3, damage: "1d6", speed: 6, initiativeBonus: 1, attackName: "Garra óssea" }),
  preset("necromancer", "creatures", "Necromante", "Chefe · senhor dos mortos", "skeleton-mage", "hostile", { hp: 38, defense: 15, attackBonus: 6, damage: "2d6+3", speed: 4, initiativeBonus: -1, attackName: "Raio necrótico", range: 5 }),
  preset("bat", "creatures", "Morcego-vampiro", "Criatura · voa e drena sangue", "vampire-bat", "hostile", { hp: 11, defense: 12, attackBonus: 5, damage: "1d8+2", speed: 8, initiativeBonus: 3, attackName: "Mordida" }),
  preset("frost-bat", "creatures", "Morcego de gelo", "Criatura · sopro gélido", "frost-bat", "hostile", { hp: 11, defense: 12, attackBonus: 5, damage: "1d8+2", speed: 8, initiativeBonus: 3, attackName: "Mordida gélida" }),
  preset("vampire", "creatures", "Vampiro", "Chefe · nobre da noite", "vampire", "hostile", { hp: 60, defense: 16, attackBonus: 7, damage: "2d8+4", speed: 6, initiativeBonus: 3, attackName: "Garras" }),
];

type Stats = SpawnTemplate["stats"];
const st = (hp: number, defense: number, attackBonus: number, damage: string, speed: number, attackName: string, range?: number): Stats => ({
  hp,
  defense,
  attackBonus,
  damage,
  speed,
  initiativeBonus: Math.max(-2, Math.min(5, Math.round((speed - 6) / 2))),
  attackName,
  ...(range ? { range } : {}),
});

/** A bestiary entry: hostile, sized by its tier (the token takes that many squares per side). */
const beast = (key: string, tier: MonsterTier, name: string, concept: string, modelId: string, stats: Stats): SpawnPreset => ({
  key,
  group: "monsters",
  tier,
  name,
  concept,
  modelId,
  attitude: "hostile",
  color: ATTITUDE_COLOR.hostile,
  size: TIER_SIZE[tier],
  stats,
});

/** The bestiary, from vermin to ancient dragons. Models: Ultimate Monsters by Quaternius (CC0). */
export const MONSTER_PRESETS: readonly SpawnPreset[] = [
  beast("slime", "small", "Slime rosa", "Gosma · fraca, mas nunca vem sozinha", "pink-slime", st(8, 9, 2, "1d4+1", 4, "Pancada gelatinosa")),
  beast("blob", "small", "Gosma verde", "Gosma · corrói o que toca", "green-blob", st(14, 8, 3, "1d6+1", 3, "Pseudópode ácido")),
  beast("mushnub", "small", "Cogumelo saltitante", "Planta · solta esporos ao morrer", "mushnub", st(7, 10, 2, "1d4", 5, "Cabeçada")),
  beast("bee", "small", "Abelha blindada", "Inseto · ferrão venenoso", "armabee", st(9, 14, 4, "1d4+2", 8, "Ferrão")),
  beast("imp", "small", "Diabrete", "Demônio menor · voa e provoca", "demon", st(10, 13, 4, "1d4+2", 8, "Garras")),
  beast("devilfish", "small", "Peixe-diabo", "Aberração · flutua fora da água", "glub", st(11, 12, 4, "1d6+1", 6, "Mordida")),
  beast("squid", "small", "Lula flutuante", "Aberração · agarra e aperta", "squidle", st(13, 12, 4, "1d6+2", 6, "Tentáculos")),
  beast("cactus", "small", "Cacto vivo", "Planta · espinhos por todo lado", "cactoro", st(14, 13, 3, "1d6+1", 4, "Espinhos")),
  beast("yeti-cub", "small", "Yeti filhote", "Fera · curioso e feroz", "yeti", st(18, 12, 4, "1d8+2", 6, "Garras")),

  beast("orc-scout", "medium", "Orc batedor", "Humanoide · ataca de emboscada", "orc-enemy", st(15, 13, 5, "1d8+3", 6, "Machadinha")),
  beast("orc", "medium", "Orc guerreiro", "Humanoide · brutal no corpo a corpo", "orc", st(30, 14, 6, "1d12+3", 6, "Machado grande")),
  beast("frogman", "medium", "Homem-sapo", "Humanoide · senhor do pântano", "frog", st(16, 12, 4, "1d6+2", 6, "Lança")),
  beast("cactus-warrior", "medium", "Cacto guerreiro", "Planta · guardião do deserto", "cactoro-big", st(26, 14, 5, "1d8+3", 5, "Soco espinhoso")),
  beast("spiky-blob", "medium", "Gosma espinhosa", "Gosma · fere quem a ataca", "green-spiky-blob", st(22, 11, 4, "1d8+2", 4, "Espinhos ácidos")),
  beast("elder-mushnub", "medium", "Cogumelo ancião", "Planta · nuvem de esporos", "mushnub-evolved", st(18, 12, 4, "1d6+2", 4, "Esporos", 2)),
  beast("warlock", "medium", "Bruxo", "Conjurador · magia sombria", "wizard", st(20, 12, 5, "2d6", 6, "Raio sombrio", 8)),
  beast("ghost", "medium", "Fantasma", "Morto-vivo · atravessa paredes", "ghost", st(22, 13, 5, "2d6", 8, "Toque gélido")),
  beast("skull-wraith", "medium", "Espectro caveira", "Morto-vivo · grito que mata", "ghost-skull", st(34, 14, 6, "2d8", 8, "Grito da morte", 4)),
  beast("totem-spirit", "medium", "Espírito tribal", "Espírito · guardião ancestral", "tribal", st(24, 13, 5, "1d10+2", 7, "Maldição", 5)),
  beast("wind-elemental", "medium", "Elemental do vento", "Elemental · rápido como a tempestade", "hywirl", st(28, 15, 6, "1d10+3", 10, "Rajada")),
  beast("lesser-golem", "medium", "Golem menor", "Constructo · lento e duro", "goleling", st(26, 16, 5, "1d10+3", 4, "Punho de pedra")),
  beast("queen-wasp", "medium", "Vespa rainha", "Inseto · comanda o enxame", "armabee-evolved", st(24, 15, 6, "1d8+3", 9, "Ferrão real")),
  beast("elder-devilfish", "medium", "Peixe-diabo ancião", "Aberração · das profundezas", "glub-evolved", st(30, 14, 6, "2d6+2", 6, "Mordida abissal")),
  beast("raptor", "medium", "Dinossauro", "Fera · caçador veloz", "dino", st(34, 13, 6, "2d6+3", 8, "Mordida")),
  beast("horned-beast", "medium", "Fera chifruda", "Fera · investe de cabeça", "monkroose", st(30, 13, 6, "1d12+3", 8, "Chifrada")),

  beast("ogre", "large", "Ogro", "Gigante · forte e burro", "orc", st(59, 11, 6, "2d8+4", 6, "Clava")),
  beast("yeti", "large", "Yeti", "Fera · terror das montanhas", "yeti-big", st(51, 12, 6, "2d6+4", 7, "Garras")),
  beast("golem", "large", "Golem de pedra", "Constructo · imune a quase tudo", "goleling-evolved", st(80, 17, 8, "2d10+5", 4, "Punho de pedra")),
  beast("demon", "large", "Demônio", "Demônio · garras em chamas", "demon-big", st(70, 15, 8, "2d8+5", 7, "Garras flamejantes")),
  beast("frost-demon", "large", "Demônio de gelo", "Demônio · congela o que toca", "blue-demon", st(75, 16, 8, "2d8+4", 7, "Garras gélidas")),
  beast("mushroom-king", "large", "Rei Cogumelo", "Planta · senhor do bosque podre", "mushroom-king", st(60, 14, 7, "2d8+3", 5, "Nuvem de esporos", 3)),
  beast("young-dragon", "large", "Dragão jovem", "Dragão · já cospe fogo", "dragon", st(110, 17, 9, "2d10+5", 8, "Sopro de fogo", 6)),

  beast("troll", "huge", "Troll das colinas", "Gigante · regenera os ferimentos", "orc", st(105, 15, 8, "3d8+5", 6, "Garras e mordida")),
  beast("frost-giant", "huge", "Gigante das neves", "Gigante · arremessa rochas", "yeti-big", st(138, 15, 9, "3d12+6", 7, "Clava de gelo", 2)),
  beast("giant-ooze", "huge", "Gosma colossal", "Gosma · engole aventureiros inteiros", "green-blob", st(120, 6, 7, "3d6+4", 3, "Engolfar")),
  beast("demon-lord", "huge", "Senhor demônio", "Demônio · general do abismo", "demon-big", st(180, 18, 11, "3d8+6", 8, "Lâmina infernal", 2)),
  beast("dragon", "huge", "Dragão adulto", "Dragão · fogo, garras e orgulho", "dragon-evolved", st(200, 19, 12, "2d10+8", 8, "Sopro de fogo", 9)),

  beast("stone-titan", "colossal", "Titã de pedra", "Constructo · uma montanha que anda", "goleling-evolved", st(300, 20, 13, "4d10+8", 5, "Esmagar", 2)),
  beast("ancient-dragon", "colossal", "Dragão ancião", "Dragão · lenda viva, fim de campanha", "dragon-evolved", st(350, 22, 15, "2d10+10", 8, "Sopro devastador", 12)),
];

export const SPAWN_GROUP_LABEL: Record<SpawnPreset["group"], string> = { people: "Pessoas", creatures: "Criaturas", monsters: "Monstros" };

/** What the editor places for one of the campaign's NPCs. */
export function npcSpawnTemplate(npc: Pick<Npc, "id" | "name" | "concept" | "attitude" | "portraitColor" | "modelId" | "stats">): SpawnTemplate {
  const kind = npc.attitude === "hostile" ? "enemy" : "npc";
  return {
    name: npc.name,
    concept: npc.concept,
    modelId: npc.modelId ?? defaultModelId({ kind, concept: npc.concept, name: npc.name }),
    color: npc.portraitColor,
    attitude: npc.attitude,
    npcId: npc.id,
    stats: { ...npc.stats },
  };
}
