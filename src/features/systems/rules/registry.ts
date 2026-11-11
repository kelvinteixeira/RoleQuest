/**
 * Picks the rules module of a system (copies use their base's module).
 * Systems without one get the generic module: the sheet works as before,
 * plus resources that grow with the class when the group set that up.
 */
import type { SystemTemplate } from "@/types/system";
import { dndRules } from "@/features/systems/dnd5e/rules";
import { genericRules } from "./generic";
import type { SystemRules } from "./types";

const MODULES: SystemRules[] = [dndRules];

export function rulesFor(system: Pick<SystemTemplate, "id" | "baseSystemId">): SystemRules {
  const id = system.baseSystemId ?? system.id;
  return MODULES.find((m) => m.systemId === id) ?? genericRules;
}

/** Runs the module's `sync`, then the class growth (a copy with classes keeps both). */
export function syncSheet(system: SystemTemplate, sheet: Parameters<SystemRules["sync"]>[1], level: number | null) {
  const rules = rulesFor(system);
  const synced = rules.sync(system, sheet, level);
  return rules === genericRules ? synced : genericRules.sync(system, synced, level);
}
