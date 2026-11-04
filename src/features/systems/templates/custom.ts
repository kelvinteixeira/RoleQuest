import type { CustomSystemId, DieType, SystemTemplate } from "@/types/system";
import { createId } from "@/lib/id";
import { attr, COMMON_CONDITIONS, resource, RESOURCE_COLORS } from "./shared";

export type CustomSystemSeed = {
  name: string;
  theme: string;
  primaryDie: DieType;
  accent?: string;
};

/**
 * "Criar meu próprio sistema": a neutral starting point the GM reshapes in
 * the system editor (attributes, skills, classes, progression, fields…).
 */
export function createCustomSystem(seed: CustomSystemSeed): SystemTemplate {
  const id = createId("custom") as CustomSystemId;
  const accent = seed.accent ?? "oklch(0.7 0.2 302)";
  return {
    id,
    kind: "custom",
    name: seed.name.trim(),
    shortName: seed.name.trim().slice(0, 14),
    tagline: seed.theme.trim() || "Sistema criado pelo mestre.",
    description: seed.theme.trim() || "Sistema personalizado.",
    genres: ["Personalizado"],
    licensing: { basis: "original", note: "Criado pelo mestre da campanha." },
    theme: { accent, glyph: "sparkles", gradient: ["oklch(0.3 0.1 300)", "oklch(0.15 0.02 300)"] },
    dice: {
      primaryDie: seed.primaryDie,
      mechanic: "custom",
      defaultFormula: `1${seed.primaryDie} + @value`,
      supportsAdvantage: false,
      notes: "Fórmula livre definida pelo mestre.",
    },
    attributes: [
      attr("body", "Corpo", "COR", [0, 10, 2]),
      attr("mind", "Mente", "MEN", [0, 10, 2]),
      attr("spirit", "Espírito", "ESP", [0, 10, 2]),
    ],
    resources: [
      resource("hp", "Vida", RESOURCE_COLORS.health, 10, { showOnToken: true }),
      resource("energy", "Energia", RESOURCE_COLORS.mana, 5, { showOnToken: true }),
    ],
    skills: [],
    abilitiesLabel: "Habilidades",
    conditions: COMMON_CONDITIONS,
    combat: {
      initiativeFormula: `1${seed.primaryDie}`,
      defenseLabel: "Defesa",
      actionEconomy: ["Ação", "Movimento"],
      distanceUnit: "squares",
      gridCellDistance: 1,
    },
    inventory: { model: "list", capacityLabel: "Itens", currencies: ["Moedas"], equipmentSlots: [] },
    progression: { model: "levels", label: "Nível", max: 10, levels: [] },
    classes: [],
    classesLabel: "Classe",
    customFields: [],
    rules: [],
    campaignTemplates: [],
    mapTemplates: [],
  };
}
