"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField, SheetSection, textInput } from "@/features/character-sheet/components/sheet-sections";
import { createId } from "@/lib/id";
import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makePanel } from "@/features/systems/rules/panel";
import type { PanelProps } from "@/features/systems/rules/types";
import { cyberBuild, humanityLoss } from "./rules";

function CyberwareList({ sheet, readOnly, update }: PanelProps) {
  const list = cyberBuild.read(sheet).cyberware;
  const set = (cyberware: typeof list) => update((s) => cyberBuild.write(s, { cyberware }));
  return (
    <SheetSection
      title={`Implantes · perda de Humanidade ${humanityLoss(sheet)}`}
      action={
        !readOnly && (
          <Button size="sm" variant="ghost" onClick={() => set([...list, { id: createId("cw"), name: "Novo implante", loss: 0 }])} leadingIcon={<Plus className="size-3.5" />}>
            Implante
          </Button>
        )
      }
    >
      {list.length === 0 ? (
        <p className="text-xs text-fg-subtle">Sem implantes. Cada um tira Humanidade (o valor rolado ou fixo do implante).</p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input aria-label="Implante" readOnly={readOnly} value={c.name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={textInput} />
              <NumberField label="Perda de Humanidade" value={c.loss} min={0} max={99} readOnly={readOnly} onChange={(loss) => set(list.map((x, j) => (j === i ? { ...x, loss } : x)))} />
              {!readOnly && (
                <Button size="icon-sm" variant="ghost" aria-label="Remover implante" onClick={() => set(list.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </SheetSection>
  );
}

export const CyberPanel = makePanel({
  title: "Cyberpunk RED",
  auto: "PV, Humanidade máxima e Sorte seguem CORPO, VON, EMP, SOR e os implantes.",
  Extra: CyberwareList,
});

export const cyberCreation = makeCreation({
  label: "Cyberpunk RED",
  summary: "Depois do básico, um guia distribui os pontos de atributo e de perícia (pacote completo).",
  scores: {
    methods: [{ key: "points", label: "Pontos", kind: "budget", min: 2, max: 8, start: 2, cost: (_k, v) => v, budget: 62, hint: "62 pontos entre os dez atributos, de 2 a 8 cada." }],
  },
  skills: {
    kind: "points",
    max: 6,
    budget: 86,
    base: (system) => Object.fromEntries(system.skills.map((k) => [k.key, 0])),
    hint: "86 pontos de perícia, até 6 em cada. Algumas perícias básicas começam em 2 no livro; confira o seu papel.",
  },
});
