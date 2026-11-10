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

export interface SpawnPreset extends SpawnTemplate {
  key: string;
  group: "people" | "creatures";
}

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

export const SPAWN_GROUP_LABEL: Record<SpawnPreset["group"], string> = { people: "Pessoas", creatures: "Criaturas" };

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
