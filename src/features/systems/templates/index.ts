import type { BuiltInSystemId, SystemTemplate } from "@/types/system";
import { dnd5e, pathfinder2e, tormenta20, tresDeTVictory } from "./fantasy";
import { callOfCthulhu, ordemParanormal, vampireMasquerade, werewolfApocalypse } from "./horror";
import { cyberpunkRed, gurps } from "./modern";

/** The 10 built-in systems, in the order shown in the library. */
export const BUILT_IN_SYSTEMS: readonly SystemTemplate[] = [
  dnd5e,
  pathfinder2e,
  callOfCthulhu,
  vampireMasquerade,
  werewolfApocalypse,
  tormenta20,
  tresDeTVictory,
  ordemParanormal,
  cyberpunkRed,
  gurps,
];

const BY_ID = new Map(BUILT_IN_SYSTEMS.map((s) => [s.id, s]));

export function getBuiltInSystem(id: BuiltInSystemId): SystemTemplate {
  const system = BY_ID.get(id);
  if (!system) throw new Error(`Unknown built-in system: ${id}`);
  return system;
}

export function isBuiltInSystemId(id: string): id is BuiltInSystemId {
  return BY_ID.has(id as BuiltInSystemId);
}

export { createCustomSystem, type CustomSystemSeed } from "./custom";
