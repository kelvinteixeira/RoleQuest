"use client";

/**
 * The UI side of each rules module: the block at the top of the sheet and
 * the guided creation. Systems without an entry get the plain sheet and the
 * plain "Novo personagem" form.
 */
import type { SystemTemplate } from "@/types/system";
import { dndCreation } from "@/features/systems/dnd5e/creation";
import { DndPanel } from "@/features/systems/dnd5e/panel";
import type { SystemRulesUi } from "./types";

const UI: Record<string, SystemRulesUi> = {
  dnd5e: { Panel: DndPanel, creation: dndCreation },
};

export function rulesUiFor(system: Pick<SystemTemplate, "id" | "baseSystemId">): SystemRulesUi {
  return UI[system.baseSystemId ?? system.id] ?? {};
}
