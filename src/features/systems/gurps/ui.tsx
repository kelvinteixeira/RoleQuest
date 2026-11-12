"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField, SheetSection, textInput } from "@/features/character-sheet/components/sheet-sections";
import { createId } from "@/lib/id";
import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makeNumberFields, makePanel } from "@/features/systems/rules/panel";
import type { PanelProps } from "@/features/systems/rules/types";
import { attributeCost, gurpsBuild, type GurpsBuild } from "./rules";

const Numbers = makeNumberFields<GurpsBuild>(
  "Pontos de personagem",
  [
    { key: "budget", label: "Total da campanha", min: 0, max: 2000 },
    { key: "skillPoints", label: "Pontos em perícias", min: 0, max: 2000 },
    { key: "extraHp", label: "PV extras (2 pontos cada)", min: -10, max: 30 },
    { key: "extraFp", label: "PF extras (3 pontos cada)", min: -10, max: 30 },
  ],
  gurpsBuild,
);

function Traits(props: PanelProps) {
  const { sheet, readOnly, update } = props;
  const list = gurpsBuild.read(sheet).traits;
  const set = (traits: typeof list) => update((s) => gurpsBuild.write(s, { traits }));
  return (
    <>
      <Numbers {...props} />
      <SheetSection
        title="Vantagens, desvantagens e peculiaridades"
        action={
          !readOnly && (
            <Button size="sm" variant="ghost" onClick={() => set([...list, { id: createId("tr"), name: "Nova vantagem", cost: 5 }])} leadingIcon={<Plus className="size-3.5" />}>
              Traço
            </Button>
          )
        }
      >
        {list.length === 0 ? (
          <p className="text-xs text-fg-subtle">Custos positivos para vantagens, negativos para desvantagens e peculiaridades.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <input aria-label="Traço" readOnly={readOnly} value={t.name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={textInput} />
                <NumberField label="Custo em pontos" value={t.cost} min={-200} max={500} readOnly={readOnly} onChange={(cost) => set(list.map((x, j) => (j === i ? { ...x, cost } : x)))} />
                {!readOnly && (
                  <Button size="icon-sm" variant="ghost" aria-label="Remover traço" onClick={() => set(list.filter((_, j) => j !== i))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetSection>
    </>
  );
}

export const GurpsPanel = makePanel({
  title: "GURPS",
  note: "Vontade e Percepção custam 5 pontos por nível acima ou abaixo de IQ. Perícias: registre os pontos gastos para fechar a conta.",
  auto: "PV e PF máximos seguem ST e HT, mais os extras comprados.",
  saveStyle: "value",
  Extra: Traits,
});

export const gurpsCreation = makeCreation({
  label: "GURPS",
  summary: "Depois do básico, um guia compra os atributos com os pontos da campanha. Vantagens, desvantagens e perícias você lança na ficha.",
  scores: {
    extras: [{ key: "budget", label: "Pontos da campanha", initial: 150, min: 0, max: 2000 }],
    methods: [
      {
        key: "points",
        label: "Pontos",
        kind: "budget",
        min: 1,
        max: 20,
        start: 10,
        cost: attributeCost,
        budget: (s) => s.extra.budget ?? 150,
        hint: "ST e HT custam 10 por nível, DX e IQ 20; Vontade e Percepção 5 por nível acima de IQ. Valores abaixo de 10 devolvem pontos.",
      },
    ],
  },
  finish: (_system, sheet, state) => gurpsBuild.write(sheet, { budget: state.extra.budget ?? 150 }),
});
