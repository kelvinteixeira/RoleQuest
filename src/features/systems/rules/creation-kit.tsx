"use client";

/**
 * Guided creation from configuration: each system says how attributes are
 * made (point buy, a pool to hand out, rolls, a budget of points), how skills
 * are picked (train N, spend points, place dots) and what else it sets at the
 * end. Classes come from the system's own list (`SystemTemplate.classes`,
 * which the group fills in for systems whose classes are not open content).
 */
import type { ReactNode } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { applyClass, createSheet } from "@/features/character-sheet/model/sheet";
import {
  ChipPicker,
  ChoiceCard,
  ChoiceGrid,
  NumberBudget,
  PointBuy,
  PoolPlacer,
  pointsSpent,
  poolAssigned,
  poolPlaced,
  ValueAssigner,
  type ScoreSlot,
} from "@/features/characters/components/creation/pieces";
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { rulesFor, syncSheet } from "./registry";
import type { CreationFlow, CreationStepProps } from "./types";

export interface KitState {
  classKey: string;
  method: string;
  scores: Record<string, number | undefined>;
  /** Values to hand out (pool methods) or rolled once (roll methods). */
  pool: number[];
  trained: string[];
  /** Skill values (points) or dots, by skill key. */
  skills: Record<string, number | undefined>;
  profile: string;
  /** System extras typed in the guide (point budget…). */
  extra: Record<string, number>;
}

type Budget = number | ((state: KitState, system: SystemTemplate) => number);

export type ScoreMethod = { key: string; label: string; hint?: string } & (
  | { kind: "pointbuy"; min: number; max: number; start: number; cost: Record<number, number>; budget: Budget }
  | { kind: "pool"; pool: number[] }
  | { kind: "roll"; roll: (attributeKey: string) => number }
  | { kind: "budget"; min: number; max: number; step?: number; start: number; cost: (attributeKey: string, value: number, all: Record<string, number>) => number; budget: Budget }
);

export type SkillMethod =
  | { kind: "train"; count: (state: KitState, system: SystemTemplate) => number; hint?: string; trainedBonus?: number }
  | { kind: "points"; budget: Budget; max: number; base: (system: SystemTemplate, sheet: CharacterSheet) => Record<string, number>; hint?: string }
  | { kind: "dots"; profiles: { key: string; label: string; pool: number[] }[]; hint?: string };

export interface KitExtra {
  key: string;
  label: string;
  initial: number;
  min: number;
  max: number;
  hint?: string;
}

export interface KitConfig {
  label: string;
  summary: string;
  /** A step to pick one of the system's classes (optional when the system has none). */
  classes?: { hint: string };
  scores: { methods: ScoreMethod[]; extras?: KitExtra[]; validate?: (scores: Record<string, number>, system: SystemTemplate) => string | null; total?: (system: SystemTemplate, key: string, value: number) => ReactNode };
  skills?: SkillMethod;
  /** Last touches on the built sheet (starting values of resources, notes…), after the rules synced it. */
  finish?: (system: SystemTemplate, sheet: CharacterSheet, state: KitState, level: number) => CharacterSheet;
}

const budgetOf = (b: Budget, state: KitState, system: SystemTemplate) => (typeof b === "function" ? b(state, system) : b);
const slotsOf = (system: SystemTemplate): ScoreSlot[] => system.attributes.map((a) => ({ key: a.key, label: a.label, abbreviation: a.abbreviation }));
const skillSlots = (system: SystemTemplate): ScoreSlot[] => system.skills.map((k) => ({ key: k.key, label: k.label, abbreviation: "" }));

function startScores(method: ScoreMethod, system: SystemTemplate): Pick<KitState, "scores" | "pool"> {
  switch (method.kind) {
    case "pointbuy":
    case "budget":
      return { scores: Object.fromEntries(system.attributes.map((a) => [a.key, method.start])), pool: [] };
    case "pool":
      return { scores: {}, pool: method.pool };
    case "roll":
      return { scores: Object.fromEntries(system.attributes.map((a) => [a.key, method.roll(a.key)])), pool: [] };
  }
}

/** Attribute values once the scores step is done (defaults where nothing was set). */
function scoresOf(system: SystemTemplate, state: KitState): Record<string, number> {
  return Object.fromEntries(system.attributes.map((a) => [a.key, state.scores[a.key] ?? a.defaultValue]));
}

/** The sheet with attributes and class only: what the skills step builds on. */
function baseSheet(system: SystemTemplate, state: KitState): CharacterSheet {
  const sheet = { ...createSheet(system), attributes: scoresOf(system, state) };
  return state.classKey ? applyClass(system, sheet, state.classKey) : sheet;
}

function spentOn(method: ScoreMethod, state: KitState, system: SystemTemplate): number {
  if (method.kind === "pointbuy") return pointsSpent(state.scores, system.attributes.map((a) => a.key), method.cost);
  if (method.kind === "budget") {
    const all = Object.fromEntries(system.attributes.map((a) => [a.key, state.scores[a.key] ?? method.start]));
    return system.attributes.reduce((sum, a) => sum + method.cost(a.key, all[a.key], all), 0);
  }
  return 0;
}

export function makeCreation(config: KitConfig): CreationFlow<KitState> {
  const steps = [...(config.classes ? ["Classe"] : []), "Atributos", ...(config.skills ? ["Perícias"] : []), "Resumo"];
  const stepName = (i: number) => steps[i];
  const methodOf = (state: KitState) => config.scores.methods.find((m) => m.key === state.method) ?? config.scores.methods[0];

  function build(system: SystemTemplate, state: KitState, level: number): CharacterSheet {
    let sheet = baseSheet(system, state);
    const skillMethod = config.skills;
    if (skillMethod?.kind === "train")
      for (const k of state.trained) sheet.skills[k] = { ...(sheet.skills[k] ?? { bonus: 0 }), trained: true, bonus: (sheet.skills[k]?.bonus ?? 0) + (skillMethod.trainedBonus ?? 0) };
    if (skillMethod?.kind === "points") {
      const base = skillMethod.base(system, sheet);
      for (const k of system.skills.map((s) => s.key)) sheet.skills[k] = { ...(sheet.skills[k] ?? { trained: false }), bonus: state.skills[k] ?? base[k] ?? 0 };
    }
    if (skillMethod?.kind === "dots") for (const k of system.skills.map((s) => s.key)) sheet.skills[k] = { ...(sheet.skills[k] ?? { trained: false }), bonus: state.skills[k] ?? 0 };
    sheet = syncSheet(system, sheet, level);
    // A new character starts with everything full.
    sheet = { ...sheet, resources: Object.fromEntries(Object.entries(sheet.resources).map(([k, r]) => [k, { ...r, current: r.max }])) };
    return config.finish?.(system, sheet, state, level) ?? sheet;
  }

  function problem(step: number, state: KitState, system: SystemTemplate): string | null {
    const name = stepName(step);
    if (name === "Classe") return null;
    if (name === "Atributos") {
      const method = methodOf(state);
      if (method.kind === "pool" && !poolAssigned(state.scores, system.attributes.map((a) => a.key), state.pool)) return "Distribua um valor para cada atributo.";
      if ((method.kind === "pointbuy" || method.kind === "budget") && spentOn(method, state, system) > budgetOf(method.budget, state, system)) return "Pontos acima do limite.";
      return config.scores.validate?.(scoresOf(system, state), system) ?? null;
    }
    if (name === "Perícias" && config.skills) {
      const s = config.skills;
      if (s.kind === "train") {
        const available = system.skills.filter((k) => !baseSheet(system, state).skills[k.key]?.trained).length;
        const want = Math.min(available, Math.max(0, s.count(state, system)));
        return state.trained.length === want ? null : `Escolha ${want} perícias.`;
      }
      if (s.kind === "points") {
        const base = s.base(system, baseSheet(system, state));
        const spent = system.skills.reduce((sum, k) => sum + ((state.skills[k.key] ?? base[k.key] ?? 0) - (base[k.key] ?? 0)), 0);
        return spent > budgetOf(s.budget, state, system) ? "Pontos acima do limite." : null;
      }
      const profile = s.profiles.find((p) => p.key === state.profile) ?? s.profiles[0];
      return poolPlaced(state.skills, profile.pool) ? null : "Coloque todos os pontos nas perícias.";
    }
    return null;
  }

  function Step({ system, step, state, onChange, level }: CreationStepProps<KitState>) {
    const set = (patch: Partial<KitState>) => onChange({ ...state, ...patch });
    const name = stepName(step);

    if (name === "Classe") {
      const classes = system.classes ?? [];
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-subtle">{config.classes!.hint}</p>
          {classes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-4 text-sm text-fg-muted">
              Este sistema ainda não tem {(system.classesLabel || "classes").toLowerCase()} cadastradas. O mestre pode cadastrar em Sistemas → duplicar como meu → Classes. Dá para seguir sem.
            </p>
          ) : (
            <ChoiceGrid>
              <ChoiceCard selected={!state.classKey} onClick={() => set({ classKey: "", trained: [] })} title="Sem classe">
                <p className="text-[11px] text-fg-subtle">Defino depois, na ficha.</p>
              </ChoiceCard>
              {classes.map((c) => (
                <ChoiceCard key={c.key} selected={state.classKey === c.key} onClick={() => set({ classKey: c.key, trained: [] })} title={c.label}>
                  {c.description && <p className="line-clamp-2 text-[11px] text-fg-subtle">{c.description}</p>}
                </ChoiceCard>
              ))}
            </ChoiceGrid>
          )}
        </div>
      );
    }

    if (name === "Atributos") {
      const method = methodOf(state);
      const slots = slotsOf(system);
      const total = (v: number, key = "") => config.scores.total?.(system, key, v) ?? v;
      return (
        <div className="flex flex-col gap-3">
          {config.scores.methods.length > 1 && (
            <Tabs
              size="sm"
              value={method.key}
              onChange={(key: string) => {
                const next = config.scores.methods.find((m) => m.key === key)!;
                set({ method: key, ...startScores(next, system) });
              }}
              items={config.scores.methods.map((m) => ({ value: m.key, label: m.label }))}
            />
          )}
          {config.scores.extras?.map((x) => (
            <label key={x.key} className="flex items-center gap-2 text-xs text-fg-muted">
              {x.label}
              <input
                type="number"
                value={state.extra[x.key] ?? x.initial}
                min={x.min}
                max={x.max}
                onChange={(e) => set({ extra: { ...state.extra, [x.key]: Math.max(x.min, Math.min(x.max, Number(e.target.value) || 0)) } })}
                className="h-8 w-20 rounded-md border border-line bg-surface-2/60 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
              />
              {x.hint && <span className="text-fg-subtle">{x.hint}</span>}
            </label>
          ))}
          {method.hint && <p className="text-xs text-fg-subtle">{method.hint}</p>}
          {method.kind === "pointbuy" && (
            <>
              <p className="text-xs text-fg-subtle">
                Pontos: {spentOn(method, state, system)}/{budgetOf(method.budget, state, system)}
              </p>
              <PointBuy
                slots={slots}
                values={state.scores}
                onChange={(scores) => set({ scores })}
                min={method.min}
                max={method.max}
                cost={method.cost}
                budget={budgetOf(method.budget, state, system)}
                total={(v) => total(v)}
              />
            </>
          )}
          {method.kind === "budget" && (
            <NumberBudget
              slots={slots}
              values={state.scores}
              onChange={(scores) => set({ scores })}
              min={method.min}
              max={method.max}
              step={method.step}
              cost={method.cost}
              budget={budgetOf(method.budget, state, system)}
              total={(key, v) => total(v, key)}
              columns={3}
            />
          )}
          {method.kind === "pool" && <ValueAssigner slots={slots} pool={state.pool} values={state.scores} onChange={(scores) => set({ scores })} total={(v) => total(v)} />}
          {method.kind === "roll" && (
            <>
              <Button size="sm" variant="secondary" className="self-start" onClick={() => set(startScores(method, system))} leadingIcon={<Dices className="size-3.5" />}>
                Rolar de novo
              </Button>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <div key={s.key} className="flex flex-col items-center rounded-lg border border-line bg-surface-2/40 py-1.5">
                    <span className="font-mono text-[11px] text-accent">{s.abbreviation}</span>
                    <span className="font-mono text-base font-semibold">{total(state.scores[s.key] ?? 0, s.key)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {problem(step, state, system) && <p className="text-xs text-warning">{problem(step, state, system)}</p>}
        </div>
      );
    }

    if (name === "Perícias" && config.skills) {
      const s = config.skills;
      if (s.kind === "train") {
        const fromClass = Object.entries(baseSheet(system, state).skills)
          .filter(([, v]) => v.trained)
          .map(([k]) => k);
        const count = Math.max(0, s.count(state, system));
        const label = (k: string) => system.skills.find((x) => x.key === k)?.label ?? k;
        return (
          <div className="flex flex-col gap-3">
            {s.hint && <p className="text-xs text-fg-subtle">{s.hint}</p>}
            {fromClass.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-fg-muted">Já vêm da classe:</p>
                <ChipPicker options={fromClass} selected={[]} max={0} onChange={() => undefined} labelOf={label} locked={fromClass} />
              </div>
            )}
            <p className="text-xs text-fg-muted">
              Escolha {count} · {state.trained.length}/{count}
            </p>
            <ChipPicker options={system.skills.map((k) => k.key).filter((k) => !fromClass.includes(k))} selected={state.trained} max={count} onChange={(trained) => set({ trained })} labelOf={label} />
          </div>
        );
      }
      if (s.kind === "points") {
        const base = s.base(system, baseSheet(system, state));
        return (
          <div className="flex flex-col gap-3">
            {s.hint && <p className="text-xs text-fg-subtle">{s.hint}</p>}
            <NumberBudget
              slots={skillSlots(system)}
              values={Object.fromEntries(system.skills.map((k) => [k.key, state.skills[k.key] ?? base[k.key] ?? 0]))}
              onChange={(skills) => set({ skills })}
              min={(k) => base[k] ?? 0}
              max={s.max}
              cost={(k, v) => v - (base[k] ?? 0)}
              budget={budgetOf(s.budget, state, system)}
              columns={3}
            />
          </div>
        );
      }
      const profile = s.profiles.find((p) => p.key === state.profile) ?? s.profiles[0];
      return (
        <div className="flex flex-col gap-3">
          {s.hint && <p className="text-xs text-fg-subtle">{s.hint}</p>}
          <Tabs size="sm" value={profile.key} onChange={(key: string) => set({ profile: key, skills: {} })} items={s.profiles.map((p) => ({ value: p.key, label: p.label }))} />
          <PoolPlacer slots={skillSlots(system)} pool={profile.pool} values={state.skills} onChange={(skills) => set({ skills })} />
        </div>
      );
    }

    // Summary: the sheet as it will be created.
    const preview = build(system, state, level);
    const derived = rulesFor(system).derived(system, preview, level);
    const cls = state.classKey ? system.classes?.find((c) => c.key === state.classKey) : undefined;
    const trained = system.skills.filter((k) => preview.skills[k.key]?.trained || (config.skills?.kind !== "train" && (preview.skills[k.key]?.bonus ?? 0) > 0));
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/30 p-3">
        <p className="text-sm font-medium">
          {cls?.label ?? "Sem classe"} · {system.progression.label} {level}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {system.attributes.map((a) => (
            <div key={a.key} className="flex flex-col items-center rounded-lg border border-line px-1 py-1.5">
              <span className="font-mono text-[10px] text-accent">{a.abbreviation}</span>
              <span className="font-mono text-base font-semibold">{preview.attributes[a.key]}</span>
            </div>
          ))}
        </div>
        {derived.length > 0 && (
          <p className="text-xs text-fg-muted">
            {derived.map((d) => (
              <span key={d.key} className="mr-3 inline-block">
                <span className="text-fg">{d.label}</span> {d.value}
              </span>
            ))}
          </p>
        )}
        <p className="text-xs text-fg-muted">
          {system.resources.map((r) => (
            <span key={r.key} className="mr-3 inline-block">
              <span className="text-fg">{r.label}</span> {preview.resources[r.key]?.current}/{preview.resources[r.key]?.max}
            </span>
          ))}
        </p>
        {trained.length > 0 && (
          <p className="text-xs text-fg-muted">
            <span className="text-fg">Perícias</span> · {trained.map((k) => (config.skills?.kind === "train" ? k.label : `${k.label} ${preview.skills[k.key]?.bonus}`)).join(", ")}
          </p>
        )}
        <p className="text-[11px] text-fg-subtle">Estrutura e fórmulas do sistema. Poderes, magias e equipamento você completa na ficha.</p>
      </div>
    );
  }

  return {
    label: config.label,
    summary: config.summary,
    steps,
    initial(system) {
      const first = config.scores.methods[0];
      const dots = config.skills?.kind === "dots" ? config.skills.profiles[0].key : "";
      return { classKey: "", method: first.key, ...startScores(first, system), trained: [], skills: {}, profile: dots, extra: Object.fromEntries((config.scores.extras ?? []).map((x) => [x.key, x.initial])) };
    },
    problem,
    Step,
    build(system, state, level) {
      const cls = state.classKey ? system.classes?.find((c) => c.key === state.classKey) : undefined;
      return { sheet: build(system, state, level), concept: cls?.label ?? "" };
    },
  };
}
