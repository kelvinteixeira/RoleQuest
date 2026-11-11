/**
 * Call of Cthulhu on the sheet: PV = (CON + TAM) / 10, PM = POD / 5,
 * Sanidade up to 99 (starting at POD), Taxa de movimento, Dano extra and
 * Corpo from FOR + TAM, and the half/fifth values of each characteristic.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attr, capResource } from "@/features/systems/rules/helpers";
import { autoDerived, setResourceMax } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";

export const cocHp = (system: SystemTemplate, sheet: CharacterSheet) => Math.max(1, Math.floor((attr(system, sheet, "con") + attr(system, sheet, "siz")) / 10));
export const cocMp = (system: SystemTemplate, sheet: CharacterSheet) => Math.max(0, Math.floor(attr(system, sheet, "pow") / 5));

/** Movement rate: 7, 8 when STR or DEX reaches SIZ, 9 when both pass it. */
export function cocMove(system: SystemTemplate, sheet: CharacterSheet): number {
  const [str, dex, siz] = ["str", "dex", "siz"].map((k) => attr(system, sheet, k));
  if (str > siz && dex > siz) return 9;
  if (str >= siz || dex >= siz) return 8;
  return 7;
}

/** Damage bonus and Build from STR + SIZ. */
export function cocBuild(system: SystemTemplate, sheet: CharacterSheet): { damage: string; build: number } {
  const total = attr(system, sheet, "str") + attr(system, sheet, "siz");
  if (total <= 64) return { damage: "−2", build: -2 };
  if (total <= 84) return { damage: "−1", build: -1 };
  if (total <= 124) return { damage: "0", build: 0 };
  if (total <= 164) return { damage: "+1D4", build: 1 };
  if (total <= 204) return { damage: "+1D6", build: 2 };
  // Each 80 points beyond add 1D6 and 1 Build.
  const extra = Math.floor((total - 205) / 80) + 1;
  return { damage: `+${extra + 1}D6`, build: 2 + extra };
}

export const cocRules: SystemRules = {
  systemId: "call-of-cthulhu",
  derived(system, sheet) {
    const b = cocBuild(system, sheet);
    return [
      { key: "hp", label: "PV máx.", value: cocHp(system, sheet), hint: "(CON + TAM) / 10" },
      { key: "mp", label: "PM máx.", value: cocMp(system, sheet), hint: "POD / 5" },
      { key: "move", label: "Movimento", value: cocMove(system, sheet), hint: "FOR e DES comparadas a TAM" },
      { key: "damage", label: "Dano extra", value: b.damage, hint: "FOR + TAM" },
      { key: "build", label: "Corpo", value: b.build, hint: "FOR + TAM" },
      { key: "dodge", label: "Esquivar base", value: Math.floor(attr(system, sheet, "dex") / 2), hint: "DES / 2" },
    ];
  },
  sync(system, sheet) {
    if (!autoDerived(sheet)) return sheet;
    let next = setResourceMax(sheet, "hp", cocHp(system, sheet));
    next = setResourceMax(next, "mp", cocMp(system, sheet));
    // Sanity's ceiling is 99 (less Cthulhu Mythos, which the player lowers by hand): losing it is not healing.
    return capResource(next, "san", Math.min(99, next.resources.san?.max ?? 99));
  },
};
