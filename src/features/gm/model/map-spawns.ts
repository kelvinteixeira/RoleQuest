/**
 * Characters the GM placed on a map in the editor become tokens when the map
 * goes to the table. Only placements new to the table spawn: re-applying the
 * same map (after the party killed the guards) brings nobody back. Pure.
 */
import type { CombatRules } from "@/features/combat/model/types";
import type { MapDocument } from "@/features/map/model/map-document";
import { freeCellNear } from "@/features/virtual-tabletop/model/map";
import type { RoomToken } from "@/features/virtual-tabletop/model/types";
import type { Npc } from "@/types/gm";
import { npcToken } from "./npc";

export function spawnTokens(next: MapDocument, previous: Pick<MapDocument, "spawns"> | null, rules: CombatRules, existing: RoomToken[], npcs: Npc[] = []): RoomToken[] {
  const already = new Set((previous?.spawns ?? []).map((s) => s.id));
  const library = new Map(npcs.map((n) => [n.id, n]));
  const placed: RoomToken[] = [...existing];
  const out: RoomToken[] = [];
  for (const spawn of next.spawns ?? []) {
    if (already.has(spawn.id)) continue;
    // A campaign NPC uses its current sheet (stats may have changed since the map was drawn).
    const npc = spawn.npcId ? library.get(spawn.npcId) : undefined;
    const source = npc ?? { id: spawn.npcId ?? spawn.id, name: spawn.name, concept: spawn.concept, attitude: spawn.attitude, portraitColor: spawn.color, modelId: spawn.modelId, stats: spawn.stats };
    const cell = freeCellNear(next, placed, spawn);
    const token: RoomToken = { ...npcToken(source, rules, cell, spawn.name), modelId: spawn.modelId };
    placed.push(token);
    out.push(token);
  }
  return out;
}
