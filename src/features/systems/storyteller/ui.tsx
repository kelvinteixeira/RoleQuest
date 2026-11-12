"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SheetSection } from "@/features/character-sheet/components/sheet-sections";
import { makeCreation, type KitConfig } from "@/features/systems/rules/creation-kit";
import { makePanel } from "@/features/systems/rules/panel";
import type { PanelProps } from "@/features/systems/rules/types";
import { clampDamage, storytellerBuild, TRACKS, trackMax, type Damage } from "./rules";

function DamageTracks(systemId: string) {
  const build = storytellerBuild(systemId);
  function Tracks({ system, sheet, readOnly, update }: PanelProps) {
    const damage = build.read(sheet).damage;
    return (
      <SheetSection title="Trilhas de dano">
        <div className="flex flex-col gap-3">
          {TRACKS.map((t) => {
            const max = trackMax(system, sheet, t.key);
            const d = clampDamage(max, damage[t.key]);
            const set = (patch: Partial<Damage>) => update((s) => build.write(s, { damage: { ...build.read(s).damage, [t.key]: clampDamage(max, { ...d, ...patch }) } }));
            return (
              <div key={t.key} className="flex flex-wrap items-center gap-3">
                <span className="w-32 text-sm text-fg-muted">{t.label}</span>
                <div className="flex gap-1" aria-label={`${t.label}: ${d.superficial} superficial, ${d.aggravated} agravado de ${max}`}>
                  {Array.from({ length: max }, (_, i) => {
                    const kind = i < d.aggravated ? "agg" : i < d.aggravated + d.superficial ? "sup" : "ok";
                    return (
                      <span
                        key={i}
                        className={cn(
                          "flex size-5 items-center justify-center rounded border font-mono text-[11px] leading-none",
                          kind === "ok" ? "border-line" : kind === "sup" ? "border-warning/60 text-warning" : "border-danger/60 bg-danger/15 text-danger",
                        )}
                      >
                        {kind === "sup" ? "/" : kind === "agg" ? "X" : ""}
                      </span>
                    );
                  })}
                </div>
                {!readOnly && (
                  <div className="ml-auto flex items-center gap-1 text-xs text-fg-subtle">
                    Superficial
                    <Button size="icon-sm" variant="ghost" aria-label={`Menos dano superficial em ${t.label}`} onClick={() => set({ superficial: d.superficial - 1 })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Mais dano superficial em ${t.label}`} onClick={() => set({ superficial: d.superficial + 1 })}>
                      <Plus className="size-3.5" />
                    </Button>
                    Agravado
                    <Button size="icon-sm" variant="ghost" aria-label={`Menos dano agravado em ${t.label}`} onClick={() => set({ aggravated: d.aggravated - 1 })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Mais dano agravado em ${t.label}`} onClick={() => set({ aggravated: d.aggravated + 1 })}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetSection>
    );
  }
  return Tracks;
}

const AUTO = "Vitalidade e Força de Vontade seguem os atributos; o valor atual segue o dano marcado nas trilhas.";

export const VampirePanel = makePanel({ title: "Vampiro: A Máscara", auto: AUTO, saveStyle: "value", Extra: DamageTracks("vampire-masquerade") });
export const WerewolfPanel = makePanel({ title: "Lobisomem: O Apocalipse", auto: AUTO, saveStyle: "value", Extra: DamageTracks("werewolf-apocalypse") });

/** Attributes: one at 4, three at 3, four at 2, one at 1. Skills: one of three spreads. */
const STORYTELLER: Omit<KitConfig, "label" | "summary" | "finish"> = {
  scores: { methods: [{ key: "spread", label: "Distribuição", kind: "pool", pool: [4, 3, 3, 3, 2, 2, 2, 2, 1], hint: "Um atributo em 4, três em 3, quatro em 2 e um em 1." }] },
  skills: {
    kind: "dots",
    hint: "Escolha um perfil e coloque os pontos nas perícias (as outras ficam em 0).",
    profiles: [
      { key: "jack", label: "Pau para toda obra", pool: [3, ...Array(8).fill(2), ...Array(10).fill(1)] },
      { key: "balanced", label: "Equilibrado", pool: [3, 3, 3, ...Array(5).fill(2), ...Array(7).fill(1)] },
      { key: "specialist", label: "Especialista", pool: [4, 3, 3, 3, 2, 2, 2, 1, 1, 1] },
    ],
  },
};

export const vampireCreation = makeCreation({
  ...STORYTELLER,
  label: "Vampiro: A Máscara",
  summary: "Depois do básico, um guia distribui atributos e perícias. Clã, disciplinas e predador você escreve na ficha.",
  // Fledglings start at Humanity 7 and Hunger 1.
  finish: (_system, sheet) => ({
    ...sheet,
    resources: {
      ...sheet.resources,
      ...(sheet.resources.humanity && { humanity: { ...sheet.resources.humanity, current: Math.min(7, sheet.resources.humanity.max) } }),
      ...(sheet.resources.hunger && { hunger: { ...sheet.resources.hunger, current: 1 } }),
    },
  }),
});

export const werewolfCreation = makeCreation({
  ...STORYTELLER,
  label: "Lobisomem: O Apocalipse",
  summary: "Depois do básico, um guia distribui atributos e perícias. Tribo, augúrio e dons você escreve na ficha.",
  // Rage starts low; the rest of the track fills in play.
  finish: (_system, sheet) => ({ ...sheet, resources: { ...sheet.resources, ...(sheet.resources.rage && { rage: { ...sheet.resources.rage, current: 1 } }) } }),
});
