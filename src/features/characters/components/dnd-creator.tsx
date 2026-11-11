"use client";

import { Check, Dices, Minus, Plus, RotateCcw, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { cryptoRng } from "@/features/dice/dice-engine";
import type { SystemTemplate } from "@/types/system";
import { armorClass, buildSheet, fixedSkills, raceBonusOf, scoreModifier, spellcasting, type DndChoices } from "@/features/systems/dnd5e/rules";
import {
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_LABEL,
  ALL_SKILLS,
  ARMOR_CATEGORY_LABEL,
  ARMORS,
  BACKGROUNDS,
  CLASSES,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  RACES,
  STANDARD_ARRAY,
  backgroundByKey,
  classByKey,
  raceByKey,
  type Ability,
  type SkillKey,
} from "@/features/systems/dnd5e/srd";

export type ScoreMethod = "standard" | "pointbuy" | "roll";

/** The creator's working state: the choices plus how the scores are being made. */
export interface CreatorState {
  race: string;
  raceChoices: Ability[];
  class: string;
  background: string;
  method: ScoreMethod;
  /** Values to hand out (standard array or rolled), empty for point buy. */
  pool: number[];
  scores: Partial<Record<Ability, number>>;
  classSkills: SkillKey[];
  freeSkills: SkillKey[];
  armor: string;
  shield: boolean;
}

export const DND_STEPS = ["Raça", "Classe", "Atributos", "Perícias", "Equipamento"] as const;

export function initialCreator(): CreatorState {
  return { race: "", raceChoices: [], class: "", background: "acolito", method: "standard", pool: STANDARD_ARRAY, scores: {}, classSkills: [], freeSkills: [], armor: "nenhuma", shield: false };
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const skillLabel = (system: SystemTemplate, key: string) => system.skills.find((s) => s.key === key)?.label ?? key;
const pointsSpent = (scores: Partial<Record<Ability, number>>) => ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[scores[a] ?? 8] ?? 0), 0);

/** Every ability has a value, and assigned values use the pool exactly once each. */
function scoresComplete(state: CreatorState): boolean {
  if (!ABILITIES.every((a) => typeof state.scores[a] === "number")) return false;
  if (state.method === "pointbuy") return pointsSpent(state.scores) <= POINT_BUY_BUDGET;
  const left = [...state.pool];
  for (const a of ABILITIES) {
    const i = left.indexOf(state.scores[a]!);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

function freeSkillCount(state: Pick<CreatorState, "race" | "background">): number {
  return (raceByKey(state.race)?.chooseSkills ?? 0) + (backgroundByKey(state.background)?.chooseSkills ?? 0);
}

/** What a step still needs, or null when it can go on. */
export function stepProblem(step: number, state: CreatorState): string | null {
  const race = raceByKey(state.race);
  const cls = classByKey(state.class);
  switch (step) {
    case 0:
      if (!race) return "Escolha uma raça.";
      if (race.chooseBonuses && state.raceChoices.length !== race.chooseBonuses.count) return `Escolha ${race.chooseBonuses.count} atributos para +${race.chooseBonuses.amount}.`;
      return null;
    case 1:
      return cls ? null : "Escolha uma classe.";
    case 2:
      if (state.method === "pointbuy" && pointsSpent(state.scores) > POINT_BUY_BUDGET) return "Pontos acima do limite.";
      return scoresComplete(state) ? null : "Distribua um valor para cada atributo.";
    case 3:
      if (cls && state.classSkills.length !== cls.skillChoices.count) return `Escolha ${cls.skillChoices.count} perícias da classe.`;
      if (state.freeSkills.length !== freeSkillCount(state)) return `Escolha ${freeSkillCount(state)} perícias livres.`;
      return null;
    default:
      return null;
  }
}

export function choicesOf(state: CreatorState): DndChoices {
  return {
    race: state.race,
    raceChoices: state.raceChoices,
    class: state.class,
    background: state.background,
    baseScores: Object.fromEntries(ABILITIES.map((a) => [a, state.scores[a] ?? 10])) as Record<Ability, number>,
    skills: [...state.classSkills, ...state.freeSkills],
    armor: state.armor,
    shield: state.shield,
  };
}

/** The class's best abilities get the best values; the rest follow in a sensible order. */
function suggest(pool: number[], classKey: string): Partial<Record<Ability, number>> {
  const cls = classByKey(classKey);
  const order: Ability[] = [...(cls?.primary ?? []), "con", "dex", "wis", "str", "cha", "int"].filter((a, i, arr) => arr.indexOf(a) === i) as Ability[];
  const sorted = [...pool].sort((a, b) => b - a);
  return Object.fromEntries(order.map((a, i) => [a, sorted[i]]));
}

function roll4d6(): number {
  const dice = Array.from({ length: 4 }, () => cryptoRng(6)).sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

/** One step of the D&D 5e creator. */
export function DndCreator({ system, step, state, onChange, level }: { system: SystemTemplate; step: number; state: CreatorState; onChange: (s: CreatorState) => void; level: number }) {
  const set = (patch: Partial<CreatorState>) => onChange({ ...state, ...patch });
  const race = raceByKey(state.race);
  const cls = classByKey(state.class);
  const bonus = raceBonusOf(state.race, state.raceChoices);

  if (step === 0)
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {RACES.map((r) => (
            <Choice key={r.key} selected={state.race === r.key} onClick={() => set({ race: r.key, raceChoices: [], freeSkills: [] })} title={r.label}>
              <p className="font-mono text-[11px] text-accent">
                {Object.entries(r.bonuses)
                  .map(([a, n]) => `${ABILITY_ABBR[a as Ability]} +${n}`)
                  .join(" · ")}
                {r.chooseBonuses && ` · +${r.chooseBonuses.amount} em ${r.chooseBonuses.count}`}
              </p>
              <p className="text-[11px] text-fg-subtle">{r.speed} ft · {r.traits.map((t) => t.name).join(", ")}</p>
            </Choice>
          ))}
        </div>
        {race?.chooseBonuses && (
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-xs text-fg-muted">
              Escolha {race.chooseBonuses.count} atributos para +{race.chooseBonuses.amount}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ABILITIES.filter((a) => !race.chooseBonuses!.exclude.includes(a)).map((a) => {
                const on = state.raceChoices.includes(a);
                const full = state.raceChoices.length >= race.chooseBonuses!.count;
                return (
                  <Chip key={a} on={on} disabled={!on && full} onClick={() => set({ raceChoices: on ? state.raceChoices.filter((x) => x !== a) : [...state.raceChoices, a] })}>
                    {ABILITY_LABEL[a]}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );

  if (step === 1)
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {CLASSES.map((c) => (
          <Choice
            key={c.key}
            selected={state.class === c.key}
            onClick={() => set({ class: c.key, classSkills: [], armor: "nenhuma", shield: false, scores: state.method === "pointbuy" ? state.scores : suggest(state.pool, c.key) })}
            title={c.label}
          >
            <p className="font-mono text-[11px] text-accent">
              d{c.hitDie} · resist. {c.saves.map((a) => ABILITY_ABBR[a]).join("/")}
            </p>
            <p className="text-[11px] text-fg-subtle">
              {c.spellcasting ? `Magia (${ABILITY_ABBR[c.spellcasting.ability]})` : "Marcial"} · {c.armor.length ? `armadura ${c.armor.map((a) => ARMOR_CATEGORY_LABEL[a]).join("/")}` : "sem armadura"}
            </p>
          </Choice>
        ))}
      </div>
    );

  if (step === 2) {
    const spent = pointsSpent(state.scores);
    const used = (except: Ability) => ABILITIES.filter((a) => a !== except).map((a) => state.scores[a]);
    const available = (a: Ability) => {
      const left = [...state.pool];
      for (const v of used(a)) {
        const i = left.indexOf(v as number);
        if (i >= 0) left.splice(i, 1);
      }
      return [...new Set(left)].sort((x, y) => y - x);
    };
    const changeMethod = (method: ScoreMethod) => {
      if (method === "standard") set({ method, pool: STANDARD_ARRAY, scores: suggest(STANDARD_ARRAY, state.class) });
      else if (method === "pointbuy") set({ method, pool: [], scores: Object.fromEntries(ABILITIES.map((a) => [a, 8])) });
      else {
        const pool = Array.from({ length: 6 }, roll4d6);
        set({ method, pool, scores: suggest(pool, state.class) });
      }
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            size="sm"
            value={state.method}
            onChange={changeMethod}
            items={[
              { value: "standard", label: "Conjunto padrão" },
              { value: "pointbuy", label: "Compra de pontos" },
              { value: "roll", label: "Rolagem 4d6" },
            ]}
          />
          {state.method === "roll" && (
            <Button size="sm" variant="ghost" onClick={() => changeMethod("roll")} leadingIcon={<Dices className="size-3.5" />}>
              Rolar de novo
            </Button>
          )}
          {state.method !== "pointbuy" && (
            <Button size="sm" variant="ghost" onClick={() => set({ scores: suggest(state.pool, state.class) })} leadingIcon={<RotateCcw className="size-3.5" />}>
              Sugerir para {cls?.label ?? "a classe"}
            </Button>
          )}
        </div>
        <p className="text-xs text-fg-subtle">
          {state.method === "standard" && "Distribua 15, 14, 13, 12, 10 e 8, um em cada atributo."}
          {state.method === "pointbuy" && `Cada atributo vai de 8 a 15. Pontos: ${spent}/${POINT_BUY_BUDGET}.`}
          {state.method === "roll" && `Rolados (4d6, descarta o menor): ${state.pool.join(", ")}.`}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ABILITIES.map((a) => {
            const base = state.scores[a];
            const total = (base ?? 0) + (bonus[a] ?? 0);
            return (
              <div key={a} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold text-accent">{ABILITY_ABBR[a]}</p>
                  <p className="truncate text-xs text-fg-muted">{ABILITY_LABEL[a]}</p>
                </div>
                {state.method === "pointbuy" ? (
                  <div className="flex items-center gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Diminuir ${ABILITY_LABEL[a]}`} disabled={(base ?? 8) <= 8} onClick={() => set({ scores: { ...state.scores, [a]: (base ?? 8) - 1 } })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center font-mono text-sm tabular-nums">{base ?? 8}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Aumentar ${ABILITY_LABEL[a]}`}
                      disabled={(base ?? 8) >= 15 || spent - POINT_BUY_COST[base ?? 8] + POINT_BUY_COST[(base ?? 8) + 1] > POINT_BUY_BUDGET}
                      onClick={() => set({ scores: { ...state.scores, [a]: (base ?? 8) + 1 } })}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <select
                    aria-label={ABILITY_LABEL[a]}
                    value={base ?? ""}
                    onChange={(e) => set({ scores: { ...state.scores, [a]: e.target.value ? Number(e.target.value) : undefined } })}
                    className="h-8 w-16 rounded-md border border-line bg-surface-2/60 px-1 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
                  >
                    <option value="">—</option>
                    {[...new Set([...(base !== undefined ? [base] : []), ...available(a)])]
                      .sort((x, y) => y - x)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                )}
                <span className="w-8 text-center font-mono text-[11px] text-accent">{bonus[a] ? `+${bonus[a]}` : ""}</span>
                <span className="w-14 text-right font-mono text-sm tabular-nums">
                  {base !== undefined ? (
                    <>
                      {total} <span className="text-fg-subtle">({signed(scoreModifier(total))})</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 3) {
    const fixed = new Set(fixedSkills(state.race, state.background));
    const free = freeSkillCount(state);
    const toggle = (list: "classSkills" | "freeSkills", key: SkillKey, max: number) => {
      const current = state[list];
      if (current.includes(key)) set({ [list]: current.filter((k) => k !== key) } as Partial<CreatorState>);
      else if (current.length < max) set({ [list]: [...current, key] } as Partial<CreatorState>);
    };
    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-fg-subtle">Antecedente</span>
          <select
            value={state.background}
            onChange={(e) => {
              const fixedNext = new Set(fixedSkills(state.race, e.target.value));
              set({ background: e.target.value, freeSkills: [], classSkills: state.classSkills.filter((k) => !fixedNext.has(k)) });
            }}
            className="h-9 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60"
          >
            {BACKGROUNDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
                {b.skills.length ? ` (${b.skills.map((k) => skillLabel(system, k)).join(", ")})` : " (2 perícias à escolha)"}
              </option>
            ))}
          </select>
        </label>
        {fixed.size > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">Já vêm da raça e do antecedente:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...fixed].map((k) => (
                <Chip key={k} on disabled>
                  {skillLabel(system, k)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {cls && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">
              Da classe ({cls.label}): escolha {cls.skillChoices.count} · {state.classSkills.length}/{cls.skillChoices.count}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cls.skillChoices.from
                .filter((k) => !fixed.has(k))
                .map((k) => {
                  const on = state.classSkills.includes(k);
                  return (
                    <Chip key={k} on={on} disabled={!on && (state.classSkills.length >= cls.skillChoices.count || state.freeSkills.includes(k))} onClick={() => toggle("classSkills", k, cls.skillChoices.count)}>
                      {skillLabel(system, k)}
                    </Chip>
                  );
                })}
            </div>
          </div>
        )}
        {free > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">
              Livres (raça/antecedente): escolha {free} · {state.freeSkills.length}/{free}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SKILLS.filter((k) => !fixed.has(k)).map((k) => {
                const on = state.freeSkills.includes(k);
                return (
                  <Chip key={k} on={on} disabled={!on && (state.freeSkills.length >= free || state.classSkills.includes(k))} onClick={() => toggle("freeSkills", k, free)}>
                    {skillLabel(system, k)}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Equipment and summary.
  const armors = ARMORS.filter((a) => a.category === "none" || cls?.armor.includes(a.category));
  const preview = buildSheet(system, choicesOf(state), level);
  const ac = armorClass(preview);
  const casting = spellcasting(system, preview, level);
  const attack = preview.combat.attacks[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-[11px] text-fg-subtle">Armadura ({cls?.armor.length ? cls.armor.map((a) => ARMOR_CATEGORY_LABEL[a]).join(", ") : "a classe não usa armadura"})</span>
          <select
            value={state.armor}
            onChange={(e) => set({ armor: e.target.value })}
            className="h-9 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60"
          >
            {armors.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
                {a.category !== "none" ? ` (${a.base}${a.dexCap === 0 ? "" : a.dexCap ? " + DES máx. 2" : " + DES"})` : ""}
              </option>
            ))}
          </select>
        </label>
        {cls?.shields && (
          <label className="flex h-9 items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" checked={state.shield} onChange={(e) => set({ shield: e.target.checked })} className="accent-[var(--color-accent-solid)]" />
            <Shield className="size-3.5" /> Escudo (+2)
          </label>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface-2/30 p-3">
        <p className="mb-2 text-sm font-medium">
          {race?.label} · {cls?.label} · nível {level}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <div key={a} className="flex flex-col items-center rounded-lg border border-line px-1 py-1.5">
              <span className="font-mono text-[10px] text-accent">{ABILITY_ABBR[a]}</span>
              <span className="font-mono text-base font-semibold">{preview.attributes[a]}</span>
              <span className="font-mono text-[10px] text-fg-subtle">{signed(scoreModifier(preview.attributes[a]))}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-xs text-fg-muted sm:grid-cols-2">
          <li>
            <span className="text-fg">CA {ac.value}</span> · {ac.explain}
          </li>
          <li>
            <span className="text-fg">PV {preview.resources.hp?.max}</span> · d{cls?.hitDie} + CON
          </li>
          <li>
            <span className="text-fg">{attack?.name}</span> · {attack?.damage.replace("@mod", ABILITY_ABBR[(attack?.attributeKey as Ability) ?? "str"])}
          </li>
          <li>
            <span className="text-fg">Deslocamento</span> · {race?.speed} ft
          </li>
          <li className="sm:col-span-2">
            <span className="text-fg">Perícias</span> ·{" "}
            {Object.entries(preview.skills)
              .filter(([, s]) => s.trained)
              .map(([k]) => skillLabel(system, k))
              .join(", ")}
          </li>
          {casting && (
            <li className="sm:col-span-2">
              <Sparkles className="mr-1 inline size-3 text-accent" />
              <span className="text-fg">Magia</span> · CD {casting.dc}, ataque {signed(casting.attack)}, espaços {casting.slots.filter((n) => n > 0).join("/") || "a partir do nível 2"}
            </li>
          )}
        </ul>
      </div>
      <p className="text-[11px] text-fg-subtle">Conteúdo do SRD 5.1 (CC-BY-4.0). Magias e equipamento detalhado você completa na ficha.</p>
    </div>
  );
}

function Choice({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors",
        selected ? "border-accent/70 bg-accent/10" : "border-line hover:border-accent/40 hover:bg-surface-2/50",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm font-medium text-fg">
        {title}
        {selected && <Check className="size-3.5 text-accent" />}
      </span>
      {children}
    </button>
  );
}

function Chip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "h-7 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-not-allowed",
        on ? "border-accent/60 bg-accent/15 text-fg" : "border-line text-fg-muted enabled:hover:text-fg disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
