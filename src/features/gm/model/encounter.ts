/**
 * Encounters: a rough difficulty estimate for the party and the tokens to
 * place at the table. Pure functions.
 */
import { averageDamage } from "@/features/combat/model/rules";
import type { CombatRules, NpcStatBlock } from "@/features/combat/model/types";
import { freeCellNear, gridDistance } from "@/features/virtual-tabletop/model/map";
import type { MapDocument } from "@/features/map/model/map-document";
import type { RoomToken } from "@/features/virtual-tabletop/model/types";
import type { Encounter, Npc } from "@/types/gm";
import { npcToken } from "./npc";

export type Difficulty = "trivial" | "easy" | "medium" | "hard" | "deadly";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { trivial: "Trivial", easy: "Fácil", medium: "Médio", hard: "Difícil", deadly: "Mortal" };

/** Threat of one NPC in d20 terms: how long it lasts × how hard it hits. */
export function threat(stats: NpcStatBlock): number {
  const perRound = averageDamage(stats.damage) * Math.min(0.95, Math.max(0.1, (stats.attackBonus + 8) / 20));
  const durability = stats.hp * (1 + (stats.defense - 12) * 0.05);
  return Math.sqrt(Math.max(1, durability) * Math.max(0.5, perRound)) * 2;
}

/** What a party of `players` characters at `level` handles as a "medium" fight. */
export function partyBudget(players: number, level: number): number {
  return Math.max(1, players) * (8 + 3 * Math.max(1, level));
}

/** Estimated difficulty (an estimate: tactics, terrain and luck matter more). */
export function encounterDifficulty(encounter: Pick<Encounter, "entries">, npcs: Pick<Npc, "id" | "stats" | "attitude">[], players: number, level: number): { difficulty: Difficulty; ratio: number; threat: number } {
  // Allies and neutrals fight on the party's side (or not at all): only hostiles count.
  const byId = new Map(npcs.filter((n) => n.attitude === "hostile").map((n) => [n.id, n]));
  const total = encounter.entries.reduce((sum, e) => {
    const npc = byId.get(e.npcId);
    return npc ? sum + threat(npc.stats) * e.count : sum;
  }, 0);
  // Many enemies act more often than their sum suggests.
  const count = encounter.entries.reduce((n, e) => n + (byId.has(e.npcId) ? e.count : 0), 0);
  const swarm = count > players ? 1 + (count - players) * 0.1 : 1;
  const ratio = (total * swarm) / partyBudget(players, level);
  const difficulty: Difficulty = ratio < 0.35 ? "trivial" : ratio < 0.7 ? "easy" : ratio < 1.15 ? "medium" : ratio < 1.6 ? "hard" : "deadly";
  return { difficulty, ratio, threat: Math.round(total * swarm) };
}

/**
 * Tokens for every creature of the encounter, placed on free squares as far as
 * the map allows from the party (around `anchor` when the GM chooses one).
 * Several of the same NPC get numbered names.
 */
export function encounterTokens(encounter: Pick<Encounter, "entries">, npcs: Npc[], map: MapDocument, rules: CombatRules, existing: RoomToken[], anchor?: { x: number; y: number }): RoomToken[] {
  const byId = new Map(npcs.map((n) => [n.id, n]));
  const party = existing.filter((t) => t.kind === "pc");
  const start = anchor ?? farthestFrom(map, party);
  const placed: RoomToken[] = [...existing];
  const out: RoomToken[] = [];
  for (const entry of encounter.entries) {
    const npc = byId.get(entry.npcId);
    if (!npc) continue;
    for (let i = 1; i <= entry.count; i++) {
      const cell = freeCellNear(map, placed, start);
      const token = npcToken(npc, rules, cell, entry.count > 1 ? `${npc.name} ${i}` : npc.name);
      placed.push(token);
      out.push(token);
    }
  }
  return out;
}

/** A square far from the party: the map corner farthest from its centre. */
function farthestFrom(map: MapDocument, party: { x: number; y: number }[]): { x: number; y: number } {
  if (party.length === 0) return { x: Math.floor(map.cols * 0.75), y: Math.floor(map.rows / 2) };
  const cx = party.reduce((s, t) => s + t.x, 0) / party.length;
  const cy = party.reduce((s, t) => s + t.y, 0) / party.length;
  const candidates = [
    { x: Math.floor(map.cols * 0.8), y: Math.floor(map.rows / 2) },
    { x: Math.floor(map.cols * 0.2), y: Math.floor(map.rows / 2) },
    { x: Math.floor(map.cols / 2), y: Math.floor(map.rows * 0.2) },
    { x: Math.floor(map.cols / 2), y: Math.floor(map.rows * 0.8) },
  ];
  return candidates.sort((a, b) => gridDistance(b, { x: cx, y: cy }) - gridDistance(a, { x: cx, y: cy }))[0];
}
