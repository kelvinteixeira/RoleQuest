/**
 * Cyberpunk RED on the sheet: PV = 10 + 5 × (CORPO + VON) / 2 rounded up,
 * gravemente ferido at half, death save = CORPO, Humanidade = EMP × 10 less
 * what the cyberware took, effective EMP from Humanidade, Sorte = SOR.
 */
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attr, moduleBuild } from "@/features/systems/rules/helpers";
import { autoDerived, setResourceMax } from "@/features/systems/rules/build";
import type { SystemRules } from "@/features/systems/rules/types";

export interface Cyberware {
  id: string;
  name: string;
  /** Humanity it took. */
  loss: number;
}
export interface CyberBuild {
  cyberware: Cyberware[];
}
export const cyberBuild = moduleBuild<CyberBuild>("cyberpunk-red", () => ({ cyberware: [] }));

export const cyberHp = (system: SystemTemplate, sheet: CharacterSheet) => 10 + 5 * Math.ceil((attr(system, sheet, "body") + attr(system, sheet, "will")) / 2);
export const humanityLoss = (sheet: CharacterSheet) => cyberBuild.read(sheet).cyberware.reduce((sum, c) => sum + Math.max(0, c.loss), 0);
export const cyberHumanity = (system: SystemTemplate, sheet: CharacterSheet) => Math.max(0, attr(system, sheet, "emp") * 10 - humanityLoss(sheet));

export const cyberRules: SystemRules = {
  systemId: "cyberpunk-red",
  derived(system, sheet) {
    const hp = cyberHp(system, sheet);
    const humanity = sheet.resources.humanity?.current ?? cyberHumanity(system, sheet);
    return [
      { key: "hp", label: "PV máx.", value: hp, hint: "10 + 5 × (CORPO + VON) / 2" },
      { key: "wounded", label: "Grav. ferido", value: Math.ceil(hp / 2), hint: "Metade dos PV" },
      { key: "death", label: "Teste de morte", value: attr(system, sheet, "body"), hint: "CORPO" },
      { key: "humanity", label: "Humanidade máx.", value: cyberHumanity(system, sheet), hint: "EMP × 10 − perdas por implantes" },
      { key: "emp", label: "EMP efetiva", value: Math.floor(humanity / 10), hint: "Humanidade atual / 10" },
      { key: "cyber", label: "Implantes", value: cyberBuild.read(sheet).cyberware.length },
    ];
  },
  sync(system, sheet) {
    if (!autoDerived(sheet)) return sheet;
    let next = setResourceMax(sheet, "hp", cyberHp(system, sheet));
    next = setResourceMax(next, "humanity", cyberHumanity(system, sheet));
    return setResourceMax(next, "luck", attr(system, sheet, "luck"));
  },
};
