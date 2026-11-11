"use client";

import { SheetSection } from "@/features/character-sheet/components/sheet-sections";
import { applySheetRanks } from "./ranks";
import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makeNumberFields, makePanel } from "@/features/systems/rules/panel";
import { syncSheet } from "@/features/systems/rules/registry";
import type { PanelProps } from "@/features/systems/rules/types";
import { pf2Build, RANKS, skillRank, type Pf2Build } from "./rules";

const RANKED = [
  { key: "perception", label: "Percepção" },
  { key: "fort", label: "Fortitude" },
  { key: "ref", label: "Reflexos" },
  { key: "will", label: "Vontade" },
  { key: "ac", label: "Defesa (CA)" },
  { key: "classdc", label: "CD de classe" },
];

function RankSelect({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled: boolean; label: string }) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-7 rounded-md border border-line bg-surface-2/60 px-1 text-xs text-fg outline-none focus:border-accent/60 disabled:opacity-70"
    >
      {RANKS.map((r, i) => (
        <option key={r} value={i}>
          {r}
        </option>
      ))}
    </select>
  );
}

function Ranks({ system, sheet, readOnly, update }: PanelProps) {
  const ranks = pf2Build.read(sheet).ranks;
  const setRank = (key: string, rank: number) => update((s) => applySheetRanks(s, { [key]: rank }));
  return (
    <SheetSection title="Graus de proficiência">
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {RANKED.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-2 text-sm text-fg-muted">
            {r.label}
            <RankSelect label={r.label} value={ranks[r.key] ?? 1} onChange={(v) => setRank(r.key, v)} disabled={readOnly} />
          </label>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-xs text-fg-subtle">Perícias</p>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {system.skills.map((k) => (
          <label key={k.key} className="flex items-center justify-between gap-2 text-sm text-fg-muted">
            {k.label}
            <RankSelect label={k.label} value={skillRank(sheet, k.key)} onChange={(v) => setRank(k.key, v)} disabled={readOnly} />
          </label>
        ))}
      </div>
    </SheetSection>
  );
}

const Numbers = makeNumberFields<Pf2Build>(
  "Ancestralidade, classe e armadura",
  [
    { key: "ancestryHp", label: "PV da ancestralidade", min: 0, max: 30 },
    { key: "classHp", label: "PV da classe por nível", min: 0, max: 30 },
    { key: "itemAc", label: "Bônus de item na CA", min: 0, max: 20 },
    { key: "dexCap", label: "Limite de DES da armadura (99 = sem)", min: 0, max: 99 },
    { key: "speed", label: "Deslocamento (ft)", min: 5, max: 120 },
  ],
  pf2Build,
);

function Extra(props: PanelProps) {
  const { system, sheet, readOnly, update } = props;
  return (
    <>
      <Numbers {...props} />
      <SheetSection title="Atributo-chave">
        <select
          aria-label="Atributo-chave"
          disabled={readOnly}
          value={pf2Build.read(sheet).keyAttribute}
          onChange={(e) => update((s) => pf2Build.write(s, { keyAttribute: e.target.value }))}
          className="h-8 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60"
        >
          {system.attributes.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </SheetSection>
      <Ranks {...props} />
    </>
  );
}

export const Pf2Panel = makePanel({
  title: "Pathfinder 2e",
  note: "Graus: treinado soma nível + 2, especialista + 4, mestre + 6, lendário + 8. PV de ancestralidade e de classe vêm dos seus livros.",
  auto: "PV máximos seguem ancestralidade, classe, nível e Constituição.",
  Extra,
});

export const pf2Creation = makeCreation({
  label: "Pathfinder 2e",
  summary: "Depois do básico, um guia monta a ficha: reforços de atributo, PV de ancestralidade e classe e perícias treinadas.",
  classes: { hint: "Classes cadastradas pela mesa (opcional): as perícias delas já vêm treinadas." },
  scores: {
    methods: [
      {
        key: "boosts",
        label: "Reforços",
        kind: "pointbuy",
        min: 0,
        max: 4,
        start: 0,
        cost: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 },
        budget: 9,
        hint: "Cada +1 é um reforço: ancestralidade (2), formação (2), classe (1) e livres (4), sem passar de +4. Uma mesma fonte não reforça o mesmo atributo duas vezes.",
      },
    ],
    extras: [
      { key: "ancestryHp", label: "PV da ancestralidade", initial: 8, min: 0, max: 30 },
      { key: "classHp", label: "PV da classe por nível", initial: 8, min: 0, max: 30 },
    ],
    total: (_s, _k, v) => (v >= 0 ? `+${v}` : `${v}`),
  },
  skills: { kind: "train", count: (s) => 3 + Math.max(0, s.scores.int ?? 0), hint: "Escolha as perícias treinadas da formação e da classe (em geral 3 + Inteligência; confira no seu livro)." },
  finish(system, sheet, state, level) {
    const built = pf2Build.write(sheet, {
      ancestryHp: state.extra.ancestryHp ?? 8,
      classHp: state.extra.classHp ?? 8,
      ranks: { perception: 1, fort: 1, ref: 1, will: 1, ac: 1, classdc: 1 },
    });
    const synced = syncSheet(system, built, level);
    const hp = synced.resources.hp;
    return hp ? { ...synced, resources: { ...synced.resources, hp: { current: hp.max, max: hp.max } } } : synced;
  },
});
