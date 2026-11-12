import type { CharacterSheet } from "@/types/character";
import { pf2Build } from "./rules";

/** Sets ranks; a skill's "trained" on the sheet follows its rank (trained or better). */
export function applySheetRanks(sheet: CharacterSheet, patch: Record<string, number>): CharacterSheet {
  const ranks = { ...pf2Build.read(sheet).ranks, ...patch };
  const skills = { ...sheet.skills };
  for (const [key, rank] of Object.entries(patch)) if (skills[key]) skills[key] = { ...skills[key], trained: rank > 0 };
  return pf2Build.write({ ...sheet, skills }, { ranks });
}
