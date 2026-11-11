/**
 * A rules module's own data on the sheet (`sheet.build`), typed by the module
 * that owns it. A build saved by another system's module is ignored.
 */
import type { CharacterSheet } from "@/types/character";

export function buildOf<T>(sheet: CharacterSheet, systemId: string): T | undefined {
  return sheet.build?.system === systemId ? (sheet.build.data as T) : undefined;
}

export function withBuild<T>(sheet: CharacterSheet, systemId: string, data: T): CharacterSheet {
  return { ...sheet, build: { system: systemId, data } };
}

/** Rules-driven values update by themselves unless the player turned that off. */
export const autoDerived = (sheet: CharacterSheet) => sheet.autoDerived !== false;

/** Sets a resource's maximum; current moves by the same amount (levelling up heals the gain, never hurts). */
export function setResourceMax(sheet: CharacterSheet, key: string, max: number): CharacterSheet {
  const res = sheet.resources[key];
  if (!res || res.max === max) return sheet;
  const current = Math.max(0, Math.min(max, res.current + (max - res.max)));
  return { ...sheet, resources: { ...sheet.resources, [key]: { current, max } } };
}
