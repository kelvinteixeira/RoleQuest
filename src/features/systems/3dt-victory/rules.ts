/**
 * 3D&T Victory on the sheet: PV and PM from Resistência (× 5) and PA from
 * Poder, as the template states; the points spent on characteristics.
 */
import { attr } from "@/features/systems/rules/helpers";
import { autoDerived, setResourceMax } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";

export const tresDeTRules: SystemRules = {
  systemId: "3dt-victory",
  derived(system, sheet) {
    const [p, h, r] = ["poder", "habilidade", "resistencia"].map((k) => attr(system, sheet, k));
    return [
      { key: "points", label: "Pontos (P+H+R)", value: p + h + r, hint: "Pontos de personagem nas características" },
      { key: "pv", label: "PV", value: Math.max(1, r * 5), hint: "Resistência × 5" },
      { key: "pm", label: "PM", value: Math.max(1, r * 5), hint: "Resistência × 5" },
      { key: "pa", label: "PA", value: p, hint: "Poder" },
    ];
  },
  sync(system, sheet) {
    if (!autoDerived(sheet)) return sheet;
    const r = attr(system, sheet, "resistencia");
    let next = setResourceMax(sheet, "pv", Math.max(1, r * 5));
    next = setResourceMax(next, "pm", Math.max(1, r * 5));
    return setResourceMax(next, "pa", Math.max(0, attr(system, sheet, "poder")));
  },
};
