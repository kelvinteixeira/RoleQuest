/**
 * The module every system gets until it has its own: resources that grow
 * with the chosen class (`ClassDefinition.resourceGrowth`), e.g. a Tormenta20
 * copy whose group typed in each class's PV per level.
 */
import type { CharacterSheet } from "@/types/character";
import type { ClassDefinition, SystemTemplate } from "@/types/system";
import { attributeModifier } from "@/features/character-sheet/model/sheet";
import { autoDerived, setResourceMax } from "./build";
import type { SystemRules } from "./types";

export function classOf(system: SystemTemplate, sheet: CharacterSheet): ClassDefinition | undefined {
  return sheet.classKey ? system.classes?.find((c) => c.key === sheet.classKey) : undefined;
}

/** A resource's maximum by the class formula, or null when the class doesn't grow it. */
export function grownMax(system: SystemTemplate, sheet: CharacterSheet, cls: ClassDefinition, resourceKey: string, level: number | null): number | null {
  const growth = cls.resourceGrowth?.[resourceKey];
  if (!growth) return null;
  const lvl = Math.max(1, level ?? 1);
  const attr = growth.attributeKey ? system.attributes.find((a) => a.key === growth.attributeKey) : undefined;
  const mod = attr ? attributeModifier(attr, sheet.attributes[attr.key] ?? attr.defaultValue) : 0;
  return Math.max(1, Math.round((cls.resourceBonus[resourceKey] ?? 0) + growth.perLevel * (lvl - 1) + mod * lvl));
}

/** How a grown resource is computed, for the sheet ("8 + 2 por nível + CON por nível"). */
export function growthHint(system: SystemTemplate, cls: ClassDefinition, resourceKey: string): string | null {
  const growth = cls.resourceGrowth?.[resourceKey];
  if (!growth) return null;
  const attr = growth.attributeKey ? system.attributes.find((a) => a.key === growth.attributeKey) : undefined;
  return [`${cls.resourceBonus[resourceKey] ?? 0} no 1º nível`, growth.perLevel ? `+${growth.perLevel} por nível` : null, attr ? `+ ${attr.abbreviation} por nível` : null].filter(Boolean).join(" ");
}

export const genericRules: SystemRules = {
  derived: () => [],
  sync(system, sheet, level) {
    const cls = classOf(system, sheet);
    if (!cls?.resourceGrowth || !autoDerived(sheet)) return sheet;
    let next = sheet;
    for (const key of Object.keys(cls.resourceGrowth)) {
      const max = grownMax(system, sheet, cls, key, level);
      if (max !== null) next = setResourceMax(next, key, max);
    }
    return next;
  },
};
