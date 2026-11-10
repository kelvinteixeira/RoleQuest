/**
 * Characters the GM placed on a map in the editor become tokens when the map
 * goes to the table. Only placements new to the table spawn: re-applying the
 * same map (after the party killed the guards) brings nobody back. Pure.
 */
import type { CombatRules } from "@/features/combat/model/types";
import type { MapDocument, SpawnTemplate } from "@/features/map/model/map-document";
import { freeCellNear } from "@/features/virtual-tabletop/model/map";
import type { RoomToken } from "@/features/virtual-tabletop/model/types";
import { sizeOf } from "@/features/virtual-tabletop/model/character-models";
import type { Npc } from "@/types/gm";
import { npcToken } from "./npc";

/**
 * A token for a ready-made character (bestiary, townsfolk) near `origin`, on
 * free ground big enough for it. A second "Ogro" at the table becomes "Ogro 2".
 */
export function templateToken(template: SpawnTemplate, map: MapDocument, rules: CombatRules, existing: RoomToken[], origin: { x: number; y: number }): RoomToken {
  const size = sizeOf({ size: template.size, modelId: template.modelId });
  const cell = freeCellNear(map, existing, origin, size);
  const taken = new Set(existing.map((t) => t.name));
  let name = template.name;
  for (let n = 2; taken.has(name); n++) name = `${template.name} ${n}`;
  const source = { id: template.npcId ?? `preset:${template.modelId}`, name, concept: template.concept, attitude: template.attitude, portraitColor: template.color, modelId: template.modelId, stats: template.stats };
  return { ...npcToken(source, rules, cell, name), modelId: template.modelId, ...(size > 1 ? { size } : {}) };
}

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
    const size = sizeOf({ size: spawn.size, modelId: spawn.modelId });
    const cell = freeCellNear(next, placed, spawn, size);
    const token: RoomToken = { ...npcToken(source, rules, cell, spawn.name), modelId: spawn.modelId, ...(size > 1 ? { size } : {}) };
    placed.push(token);
    out.push(token);
  }
  return out;
}
