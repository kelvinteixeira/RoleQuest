"use client";

/**
 * The UI side of each rules module: the block at the top of the sheet and
 * the guided creation. Systems without an entry get the plain sheet and the
 * plain "Novo personagem" form.
 */
import type { SystemTemplate } from "@/types/system";
import { dndCreation } from "@/features/systems/dnd5e/creation";
import { DndPanel } from "@/features/systems/dnd5e/panel";
import { Pf2Panel, pf2Creation } from "@/features/systems/pathfinder2e/ui";
import { T20Panel, t20Creation } from "@/features/systems/tormenta20/ui";
import { TresDeTPanel, tresDeTCreation } from "@/features/systems/3dt-victory/ui";
import { CocPanel, cocCreation } from "@/features/systems/call-of-cthulhu/ui";
import { VampirePanel, vampireCreation, WerewolfPanel, werewolfCreation } from "@/features/systems/storyteller/ui";
import { OrdemPanel, ordemCreation } from "@/features/systems/ordem-paranormal/ui";
import { CyberPanel, cyberCreation } from "@/features/systems/cyberpunk-red/ui";
import { GurpsPanel, gurpsCreation } from "@/features/systems/gurps/ui";
import type { SystemRulesUi } from "./types";

const UI: Record<string, SystemRulesUi> = {
  dnd5e: { Panel: DndPanel, creation: dndCreation },
  pathfinder2e: { Panel: Pf2Panel, creation: pf2Creation },
  tormenta20: { Panel: T20Panel, creation: t20Creation },
  "3dt-victory": { Panel: TresDeTPanel, creation: tresDeTCreation },
  "call-of-cthulhu": { Panel: CocPanel, creation: cocCreation },
  "vampire-masquerade": { Panel: VampirePanel, creation: vampireCreation },
  "werewolf-apocalypse": { Panel: WerewolfPanel, creation: werewolfCreation },
  "ordem-paranormal": { Panel: OrdemPanel, creation: ordemCreation },
  "cyberpunk-red": { Panel: CyberPanel, creation: cyberCreation },
  gurps: { Panel: GurpsPanel, creation: gurpsCreation },
};

export function rulesUiFor(system: Pick<SystemTemplate, "id" | "baseSystemId">): SystemRulesUi {
  return UI[system.baseSystemId ?? system.id] ?? {};
}
