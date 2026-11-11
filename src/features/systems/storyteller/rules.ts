/**
 * Storyteller systems (Vampiro: A Máscara, Lobisomem: O Apocalipse): Vitalidade
 * = Vigor + 3, Força de Vontade = Autocontrole + Determinação, and a damage
 * track with superficial and aggravated damage for each. Clans, tribes,
 * disciplines and gifts are the group's to write in.
 */
import type { CharacterSheet } from "@/types/character";
import type { BuiltInSystemId, SystemTemplate } from "@/types/system";
import { attr, moduleBuild } from "@/features/systems/rules/helpers";
import { autoDerived, buildOf, setResourceMax } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";

export type TrackKey = "health" | "willpower";
export interface Damage {
  superficial: number;
  aggravated: number;
}
export interface StorytellerBuild {
  damage: Record<TrackKey, Damage>;
}

const none = (): Damage => ({ superficial: 0, aggravated: 0 });
export const storytellerBuild = (systemId: string) => moduleBuild<StorytellerBuild>(systemId, () => ({ damage: { health: none(), willpower: none() } }));

export const TRACKS: { key: TrackKey; label: string }[] = [
  { key: "health", label: "Vitalidade" },
  { key: "willpower", label: "Força de Vontade" },
];

export function trackMax(system: SystemTemplate, sheet: CharacterSheet, key: TrackKey): number {
  return key === "health" ? attr(system, sheet, "stamina") + 3 : attr(system, sheet, "composure") + attr(system, sheet, "resolve");
}

/** Damage that fits the track: aggravated first, superficial in the boxes left. */
export function clampDamage(max: number, d: Damage): Damage {
  const aggravated = Math.max(0, Math.min(max, d.aggravated));
  return { aggravated, superficial: Math.max(0, Math.min(max - aggravated, d.superficial)) };
}

export function makeStorytellerRules(systemId: BuiltInSystemId): SystemRules {
  const build = storytellerBuild(systemId);
  return {
    systemId,
    derived(system, sheet) {
      const damage = build.read(sheet).damage;
      return TRACKS.flatMap((t) => {
        const d = clampDamage(trackMax(system, sheet, t.key), damage[t.key]);
        return [
          { key: t.key, label: t.label, value: trackMax(system, sheet, t.key), hint: t.key === "health" ? "Vigor + 3" : "Autocontrole + Determinação" },
          { key: `${t.key}-dmg`, label: "Dano (sup./agr.)", value: `${d.superficial}/${d.aggravated}` },
        ];
      });
    },
    // Max follows the attributes; once the tracks are used, current = boxes left after damage
    // (before that, current is whatever the table set, e.g. damage taken in the room).
    sync(system, sheet) {
      if (!autoDerived(sheet)) return sheet;
      const tracked = !!buildOf(sheet, systemId);
      const damage = build.read(sheet).damage;
      let next = sheet;
      for (const t of TRACKS) {
        const res = next.resources[t.key];
        if (!res) continue;
        const max = trackMax(system, sheet, t.key);
        if (!tracked) {
          next = setResourceMax(next, t.key, max);
          continue;
        }
        const d = clampDamage(max, damage[t.key]);
        const current = max - d.superficial - d.aggravated;
        if (res.max !== max || res.current !== current) next = { ...next, resources: { ...next.resources, [t.key]: { max, current } } };
      }
      return next;
    },
  };
}

export const vampireRules = makeStorytellerRules("vampire-masquerade");
export const werewolfRules = makeStorytellerRules("werewolf-apocalypse");
