/**
 * NPC rules: what players may see, validation, and turning an NPC into a
 * token at the table. Pure functions.
 */
import { createId } from "@/lib/id";
import { adaptNpcStats, isValidDamage } from "@/features/combat/model/rules";
import type { CombatRules, NpcStatBlock } from "@/features/combat/model/types";
import { defaultModelId } from "@/features/virtual-tabletop/model/character-models";
import type { RoomToken } from "@/features/virtual-tabletop/model/types";
import type { Npc, NpcAttitude, NpcInput } from "@/types/gm";

export const ATTITUDE_LABEL: Record<NpcAttitude, string> = { ally: "Aliado", neutral: "Neutro", hostile: "Hostil" };

export const DEFAULT_NPC_STATS: NpcStatBlock = { hp: 11, defense: 12, attackBonus: 3, damage: "1d6+1", speed: 6, initiativeBonus: 1, attackName: "Ataque" };

export function blankNpc(campaignId: string): NpcInput {
  return {
    campaignId,
    name: "",
    concept: "",
    attitude: "neutral",
    portraitColor: "oklch(0.6 0.12 250)",
    location: "",
    description: "",
    secretNotes: "",
    facts: [],
    stats: { ...DEFAULT_NPC_STATS },
    known: false,
  };
}

export const newFact = (text: string) => ({ id: createId("fact"), text: text.trim(), revealed: false });

export function validateNpc(input: Pick<NpcInput, "name" | "stats">): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Dê um nome ao NPC.";
  else if (input.name.trim().length > 60) errors.name = "Até 60 caracteres.";
  const s = input.stats;
  if (!(s.hp >= 1 && s.hp <= 999)) errors.hp = "PV entre 1 e 999.";
  if (!(s.defense >= 1 && s.defense <= 40)) errors.defense = "Defesa entre 1 e 40.";
  if (!(s.speed >= 0 && s.speed <= 30)) errors.speed = "Deslocamento entre 0 e 30.";
  if (!isValidDamage(s.damage.replace(/\s+/g, ""))) errors.damage = "Use uma fórmula como 1d8+3.";
  if (!Number.isFinite(s.attackBonus) || Math.abs(s.attackBonus) > 30) errors.attackBonus = "Bônus entre -30 e 30.";
  if (!Number.isFinite(s.initiativeBonus) || Math.abs(s.initiativeBonus) > 30) errors.initiativeBonus = "Bônus entre -30 e 30.";
  if (s.range !== undefined && !(s.range >= 1 && s.range <= 60)) errors.range = "Alcance entre 1 e 60.";
  return errors;
}

/**
 * What a player may see of an NPC: nothing until it is known; then the public
 * description and the facts the GM revealed — never secrets or stats.
 */
export interface KnownNpc {
  id: string;
  name: string;
  concept: string;
  portraitColor: string;
  location: string;
  description: string;
  facts: { id: string; text: string }[];
}

export function playerView(npc: Npc): KnownNpc | null {
  if (!npc.known) return null;
  return {
    id: npc.id,
    name: npc.name,
    concept: npc.concept,
    portraitColor: npc.portraitColor,
    location: npc.location,
    description: npc.description,
    facts: npc.facts.filter((f) => f.revealed).map(({ id, text }) => ({ id, text })),
  };
}

/** A token for the NPC in the room's system. Hostile NPCs join the enemy side. */
export function npcToken(npc: Pick<Npc, "id" | "name" | "concept" | "attitude" | "portraitColor" | "modelId" | "stats">, rules: CombatRules, cell: { x: number; y: number }, label = npc.name): RoomToken {
  const { stats, hp } = adaptNpcStats(rules, npc.stats);
  const kind = npc.attitude === "hostile" ? "enemy" : "npc";
  return {
    id: createId("tok"),
    kind,
    controller: "gm",
    name: label,
    ownerName: "Mestre",
    concept: npc.concept,
    color: npc.portraitColor,
    modelId: npc.modelId ?? defaultModelId({ kind, concept: npc.concept, name: npc.name }),
    x: cell.x,
    y: cell.y,
    hp: { current: hp, max: hp },
    stats,
    npc: { ...npc.stats },
    conditions: [],
  };
}
