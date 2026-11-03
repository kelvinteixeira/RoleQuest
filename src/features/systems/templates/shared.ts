import type { AttributeDefinition, ConditionDefinition, ResourceDefinition, SkillDefinition } from "@/types/system";

/** Compact builders keep the template files readable. */
export function attr(
  key: string,
  label: string,
  abbreviation: string,
  range: [min: number, max: number, defaultValue: number],
  extra: Partial<AttributeDefinition> = {},
): AttributeDefinition {
  const [min, max, defaultValue] = range;
  return { key, label, abbreviation, min, max, defaultValue, ...extra };
}

export function resource(
  key: string,
  label: string,
  color: string,
  defaultMax: number,
  extra: Partial<ResourceDefinition> = {},
): ResourceDefinition {
  return { key, label, color, defaultMax, showOnToken: false, ...extra };
}

export function skills(attributeKey: string | undefined, labels: string[]): SkillDefinition[] {
  return labels.map((label) => ({
    key: label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),
    label,
    attributeKey,
  }));
}

export function condition(key: string, label: string, description: string): ConditionDefinition {
  return { key, label, description };
}

/** Resource colors shared across systems so the table reads consistently. */
export const RESOURCE_COLORS = {
  health: "oklch(0.68 0.19 25)",
  mana: "oklch(0.7 0.14 250)",
  sanity: "oklch(0.74 0.12 300)",
  stamina: "oklch(0.8 0.14 85)",
  will: "oklch(0.75 0.1 200)",
  luck: "oklch(0.8 0.15 140)",
  hunger: "oklch(0.55 0.2 15)",
  rage: "oklch(0.7 0.18 45)",
  humanity: "oklch(0.78 0.06 260)",
} as const;

/** Conditions that make sense in almost every system. */
export const COMMON_CONDITIONS: ConditionDefinition[] = [
  condition("prone", "Caído", "Está no chão; levantar consome parte do movimento."),
  condition("stunned", "Atordoado", "Não consegue agir de forma plena até se recuperar."),
  condition("unconscious", "Inconsciente", "Sem consciência do que acontece ao redor."),
  condition("frightened", "Amedrontado", "Evita a fonte do medo e age com dificuldade perto dela."),
  condition("restrained", "Contido", "Movimento impedido por amarras, redes ou agarrões."),
];
