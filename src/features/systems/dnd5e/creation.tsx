"use client";

/**
 * D&D 5e guided creation (SRD 5.1): race, class, ability scores, skills and
 * background, equipment and a summary. Built from the shared creation pieces.
 */
import { Dices, RotateCcw, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cryptoRng } from "@/features/dice/dice-engine";
import { assignByPriority, ChipPicker, ChoiceCard, ChoiceGrid, PointBuy, pointsSpent, poolAssigned, ValueAssigner, type ScoreSlot } from "@/features/characters/components/creation/pieces";
import type { CreationFlow, CreationStepProps } from "@/features/systems/rules/types";
import type { SystemTemplate } from "@/types/system";
import { armorClass, buildSheet, conceptOf, fixedSkills, raceBonusOf, scoreModifier, spellcasting, type DndChoices } from "./rules";
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
} from "./srd";

export type ScoreMethod = "standard" | "pointbuy" | "roll";

/** The guide's working state: the choices plus how the scores are being made. */
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

const STEPS = ["Raça", "Classe", "Atributos", "Perícias", "Equipamento"] as const;
const SLOTS: ScoreSlot[] = ABILITIES.map((a) => ({ key: a, label: ABILITY_LABEL[a], abbreviation: ABILITY_ABBR[a] }));
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const skillLabel = (system: SystemTemplate, key: string) => system.skills.find((s) => s.key === key)?.label ?? key;
const scoreTotal = (v: number) => (
  <>
    {v} <span className="text-fg-subtle">({signed(scoreModifier(v))})</span>
  </>
);

function initial(): CreatorState {
  return { race: "", raceChoices: [], class: "", background: "acolito", method: "standard", pool: STANDARD_ARRAY, scores: {}, classSkills: [], freeSkills: [], armor: "nenhuma", shield: false };
}

const freeSkillCount = (state: Pick<CreatorState, "race" | "background">) => (raceByKey(state.race)?.chooseSkills ?? 0) + (backgroundByKey(state.background)?.chooseSkills ?? 0);

/** The class's best abilities get the best values; the rest follow in a sensible order. */
function suggest(pool: number[], classKey: string): Partial<Record<Ability, number>> {
  const order = [...(classByKey(classKey)?.primary ?? []), "con", "dex", "wis", "str", "cha", "int"].filter((a, i, arr) => arr.indexOf(a) === i);
  return assignByPriority(pool, order);
}

function roll4d6(): number {
  const dice = Array.from({ length: 4 }, () => cryptoRng(6)).sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

function problem(step: number, state: CreatorState): string | null {
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
      if (state.method === "pointbuy") return pointsSpent(state.scores, ABILITIES, POINT_BUY_COST) > POINT_BUY_BUDGET ? "Pontos acima do limite." : null;
      return poolAssigned(state.scores, ABILITIES, state.pool) ? null : "Distribua um valor para cada atributo.";
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

function Step({ system, step, state, onChange, level }: CreationStepProps<CreatorState>) {
  const set = (patch: Partial<CreatorState>) => onChange({ ...state, ...patch });
  const race = raceByKey(state.race);
  const cls = classByKey(state.class);
  const bonus = raceBonusOf(state.race, state.raceChoices);

  if (step === 0)
    return (
      <div className="flex flex-col gap-3">
        <ChoiceGrid>
          {RACES.map((r) => (
            <ChoiceCard key={r.key} selected={state.race === r.key} onClick={() => set({ race: r.key, raceChoices: [], freeSkills: [] })} title={r.label}>
              <p className="font-mono text-[11px] text-accent">
                {Object.entries(r.bonuses)
                  .map(([a, n]) => `${ABILITY_ABBR[a as Ability]} +${n}`)
                  .join(" · ")}
                {r.chooseBonuses && ` · +${r.chooseBonuses.amount} em ${r.chooseBonuses.count}`}
              </p>
              <p className="text-[11px] text-fg-subtle">
                {r.speed} ft · {r.traits.map((t) => t.name).join(", ")}
              </p>
            </ChoiceCard>
          ))}
        </ChoiceGrid>
        {race?.chooseBonuses && (
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-xs text-fg-muted">
              Escolha {race.chooseBonuses.count} atributos para +{race.chooseBonuses.amount}:
            </p>
            <ChipPicker
              options={ABILITIES.filter((a) => !race.chooseBonuses!.exclude.includes(a))}
              selected={state.raceChoices}
              max={race.chooseBonuses.count}
              onChange={(raceChoices) => set({ raceChoices })}
              labelOf={(a) => ABILITY_LABEL[a]}
            />
          </div>
        )}
      </div>
    );

  if (step === 1)
    return (
      <ChoiceGrid>
        {CLASSES.map((c) => (
          <ChoiceCard
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
          </ChoiceCard>
        ))}
      </ChoiceGrid>
    );

  if (step === 2) {
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
          {state.method === "pointbuy" && `Cada atributo vai de 8 a 15. Pontos: ${pointsSpent(state.scores, ABILITIES, POINT_BUY_COST)}/${POINT_BUY_BUDGET}.`}
          {state.method === "roll" && `Rolados (4d6, descarta o menor): ${state.pool.join(", ")}.`}
        </p>
        {state.method === "pointbuy" ? (
          <PointBuy slots={SLOTS} values={state.scores} onChange={(scores) => set({ scores })} min={8} max={15} cost={POINT_BUY_COST} budget={POINT_BUY_BUDGET} bonuses={bonus} total={scoreTotal} />
        ) : (
          <ValueAssigner slots={SLOTS} pool={state.pool} values={state.scores} onChange={(scores) => set({ scores })} bonuses={bonus} total={scoreTotal} />
        )}
      </div>
    );
  }

  if (step === 3) {
    const fixed = fixedSkills(state.race, state.background);
    const free = freeSkillCount(state);
    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-fg-subtle">Antecedente</span>
          <select
            value={state.background}
            onChange={(e) => {
              const fixedNext = fixedSkills(state.race, e.target.value);
              set({ background: e.target.value, freeSkills: [], classSkills: state.classSkills.filter((k) => !fixedNext.includes(k)) });
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
        {fixed.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">Já vêm da raça e do antecedente:</p>
            <ChipPicker options={fixed} selected={[]} max={0} onChange={() => undefined} labelOf={(k) => skillLabel(system, k)} locked={fixed} />
          </div>
        )}
        {cls && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">
              Da classe ({cls.label}): escolha {cls.skillChoices.count} · {state.classSkills.length}/{cls.skillChoices.count}
            </p>
            <ChipPicker
              options={cls.skillChoices.from.filter((k) => !fixed.includes(k))}
              selected={state.classSkills}
              max={cls.skillChoices.count}
              onChange={(classSkills) => set({ classSkills })}
              labelOf={(k) => skillLabel(system, k)}
              blocked={state.freeSkills}
            />
          </div>
        )}
        {free > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-fg-muted">
              Livres (raça/antecedente): escolha {free} · {state.freeSkills.length}/{free}
            </p>
            <ChipPicker
              options={ALL_SKILLS.filter((k) => !fixed.includes(k))}
              selected={state.freeSkills}
              max={free}
              onChange={(freeSkills) => set({ freeSkills })}
              labelOf={(k) => skillLabel(system, k)}
              blocked={state.classSkills}
            />
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
          <select value={state.armor} onChange={(e) => set({ armor: e.target.value })} className="h-9 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60">
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

export const dndCreation: CreationFlow<CreatorState> = {
  label: "D&D 5e (SRD 5.1)",
  summary: "Depois do básico, um guia monta a ficha de D&D: raça, classe, atributos, perícias e equipamento.",
  steps: STEPS,
  initial,
  problem: (step, state) => problem(step, state),
  Step,
  build(system, state, level) {
    const choices = choicesOf(state);
    return { sheet: buildSheet(system, choices, level), concept: conceptOf(choices) };
  },
};
