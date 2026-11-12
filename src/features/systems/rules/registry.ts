/**
 * Picks the rules module of a system (copies use their base's module).
 * Systems without one get the generic module: the sheet works as before,
 * plus resources that grow with the class when the group set that up.
 */
import type { SystemTemplate } from "@/types/system";
import { dndRules } from "@/features/systems/dnd5e/rules";
import { pf2Rules } from "@/features/systems/pathfinder2e/rules";
import { t20Rules } from "@/features/systems/tormenta20/rules";
import { tresDeTRules } from "@/features/systems/3dt-victory/rules";
import { cocRules } from "@/features/systems/call-of-cthulhu/rules";
import { vampireRules, werewolfRules } from "@/features/systems/storyteller/rules";
import { ordemRules } from "@/features/systems/ordem-paranormal/rules";
import { cyberRules } from "@/features/systems/cyberpunk-red/rules";
import { gurpsRules } from "@/features/systems/gurps/rules";
import { genericRules } from "./generic";
import type { SystemRules } from "./types";

/** One module per built-in system; copies of a system use its module. */
export const MODULES: SystemRules[] = [dndRules, pf2Rules, t20Rules, tresDeTRules, cocRules, vampireRules, werewolfRules, ordemRules, cyberRules, gurpsRules];

export function rulesFor(system: Pick<SystemTemplate, "id" | "baseSystemId">): SystemRules {
  const id = system.baseSystemId ?? system.id;
  return MODULES.find((m) => m.systemId === id) ?? genericRules;
}

/** Runs the module's `sync`, then the class growth (a copy with classes keeps both). */
export function syncSheet(system: SystemTemplate, sheet: Parameters<SystemRules["sync"]>[1], level: number | null) {
  const rules = rulesFor(system);
  const synced = rules.sync(system, sheet, level);
  return rules === genericRules ? synced : genericRules.sync(system, synced, rules.classLevel ? rules.classLevel(level) : level);
}
