/** Small readers shared by the rules modules. */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { buildOf, withBuild } from "./build";

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** An attribute's value on the sheet (the template default when unset). */
export function attr(system: SystemTemplate, sheet: CharacterSheet, key: string): number {
  return sheet.attributes[key] ?? system.attributes.find((a) => a.key === key)?.defaultValue ?? 0;
}

export const lvl = (level: number | null) => Math.max(1, level ?? 1);

/** Typed access to a module's build with defaults filled in. */
export function moduleBuild<T extends object>(systemId: string, defaults: () => T) {
  return {
    read: (sheet: CharacterSheet): T => ({ ...defaults(), ...(buildOf<Partial<T>>(sheet, systemId) ?? {}) }),
    write: (sheet: CharacterSheet, patch: Partial<T>): CharacterSheet => withBuild(sheet, systemId, { ...defaults(), ...(buildOf<Partial<T>>(sheet, systemId) ?? {}), ...patch }),
  };
}

/** Sets a resource's maximum without touching its current value (sanity, which the max only caps). */
export function capResource(sheet: CharacterSheet, key: string, max: number): CharacterSheet {
  const res = sheet.resources[key];
  if (!res || res.max === max) return sheet;
  return { ...sheet, resources: { ...sheet.resources, [key]: { max, current: Math.min(res.current, max) } } };
}
