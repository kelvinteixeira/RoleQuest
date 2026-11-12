"use client";

import { cryptoRng } from "@/features/dice/dice-engine";
import { SheetSection } from "@/features/character-sheet/components/sheet-sections";
import { makeCreation } from "@/features/systems/rules/creation-kit";
import { attr } from "@/features/systems/rules/helpers";
import { makePanel } from "@/features/systems/rules/panel";
import type { PanelProps } from "@/features/systems/rules/types";

const d = (sides: number, n: number) => Array.from({ length: n }, () => cryptoRng(sides)).reduce((a, b) => a + b, 0);
/** STR, CON, DEX, APP, POW: 3d6 × 5; SIZ, INT, EDU: (2d6 + 6) × 5. */
export const rollCharacteristic = (key: string) => (["siz", "int", "edu"].includes(key) ? (d(6, 2) + 6) * 5 : d(6, 3) * 5);

function HalfFifth({ system, sheet }: PanelProps) {
  return (
    <SheetSection title="Valores: normal · metade · quinto">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {system.attributes.map((a) => {
          const v = attr(system, sheet, a.key);
          return (
            <div key={a.key} className="rounded-lg border border-line bg-surface-2/40 px-2 py-1.5 text-center">
              <p className="font-mono text-[11px] text-accent">{a.abbreviation}</p>
              <p className="font-mono text-sm tabular-nums">
                {v} · {Math.floor(v / 2)} · {Math.floor(v / 5)}
              </p>
            </div>
          );
        })}
      </div>
    </SheetSection>
  );
}

export const CocPanel = makePanel({
  title: "Call of Cthulhu",
  note: "Sanidade começa em POD e tem teto 99 menos Mitos de Cthulhu (ajuste o máximo à mão quando o Mitos subir).",
  auto: "PV e PM máximos seguem CON, TAM e POD.",
  Extra: HalfFifth,
});

export const cocCreation = makeCreation({
  label: "Call of Cthulhu",
  summary: "Depois do básico, um guia rola (ou distribui) as características e reparte os pontos de ocupação e de interesse pessoal.",
  scores: {
    methods: [
      { key: "roll", label: "Rolagem", kind: "roll", roll: rollCharacteristic, hint: "FOR, CON, DES, APA e POD: 3d6 × 5. TAM, INT e EDU: (2d6 + 6) × 5." },
      { key: "points", label: "Distribuição", kind: "budget", min: 15, max: 90, step: 5, start: 50, cost: (_k, v) => v, budget: 460, hint: "460 pontos entre as oito características (de 15 a 90 cada)." },
    ],
  },
  skills: {
    kind: "points",
    max: 90,
    budget: (s) => (s.scores.edu ?? 50) * 4 + (s.scores.int ?? 50) * 2,
    base: (system, sheet) => ({ ...Object.fromEntries(system.skills.map((k) => [k.key, sheet.skills[k.key]?.bonus ?? 0])), esquivar: Math.floor((sheet.attributes.dex ?? 50) / 2) }),
    hint: "Pontos de ocupação (EDU × 4) + interesse pessoal (INT × 2), somados aos valores base. Nenhuma perícia passa de 90.",
  },
  finish(_system, sheet) {
    const luck = d(6, 3) * 5;
    const pow = sheet.attributes.pow ?? 50;
    return { ...sheet, resources: { ...sheet.resources, luck: { current: luck, max: 99 }, san: { current: pow, max: 99 } } };
  },
});
