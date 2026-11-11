"use client";

import { AlertTriangle, BookOpen, Shield, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { proficiencyBonus } from "../model/sheet";
import { deriveInitiative } from "@/features/combat/model/profile";
import { armorClass, changeClass, changeRace, emptyBuild, passivePerception, saveBonus, saveProficient, spellcasting } from "@/features/systems/dnd5e/rules";
import { ABILITIES, ABILITY_ABBR, ABILITY_LABEL, ARMOR_CATEGORY_LABEL, ARMORS, BACKGROUNDS, CLASSES, classByKey, RACES, raceByKey, type Trait } from "@/features/systems/dnd5e/srd";
import { RollButton, SheetSection, type SectionProps } from "./sheet-sections";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const select =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60 disabled:opacity-70";

/**
 * D&D 5e (SRD 5.1): race, class, background and armor, and what follows from
 * them — armor class, saving throws, passive perception, hit die and spellcasting.
 */
export function DndSection({ system, sheet, readOnly, update, onCheck, level }: SectionProps & { level: number | null }) {
  const build = sheet.dnd ?? emptyBuild();
  const cls = classByKey(build.class);
  const race = raceByKey(build.race);
  const ac = armorClass(sheet);
  const casting = spellcasting(system, sheet, level);
  const prof = proficiencyBonus(system, level);
  const setBuild = (patch: Partial<typeof build>) => update((s) => ({ ...s, dnd: { ...(s.dnd ?? emptyBuild()), ...patch } }));

  return (
    <div className="flex flex-col gap-4">
      <SheetSection title="Raça, classe e antecedente" action={<span className="text-[10px] text-fg-subtle">SRD 5.1 · CC-BY-4.0</span>}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Raça">
            <select aria-label="Raça" disabled={readOnly} value={build.race} onChange={(e) => update((s) => changeRace(s, e.target.value))} className={select}>
              <option value="">—</option>
              {RACES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Classe">
            <select aria-label="Classe" disabled={readOnly} value={build.class} onChange={(e) => update((s) => changeClass(s, e.target.value))} className={select}>
              <option value="">—</option>
              {CLASSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} (d{c.hitDie})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Antecedente">
            <select aria-label="Antecedente" disabled={readOnly} value={build.background} onChange={(e) => setBuild({ background: e.target.value })} className={select}>
              <option value="">—</option>
              {BACKGROUNDS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="CA" value={ac.value} hint={ac.explain} />
          <Stat label="Iniciativa" value={signed(deriveInitiative(system, sheet).value)} />
          <Stat label="Desloc." value={`${sheet.combat.speed * 5} ft`} hint={race ? `${race.label}: ${race.speed} ft` : undefined} />
          <Stat label="Proficiência" value={signed(prof)} />
          <Stat label="Perc. passiva" value={passivePerception(system, sheet, level)} />
          <Stat label="Dado de vida" value={cls ? `${Math.max(1, level ?? 1)}d${cls.hitDie}` : "—"} />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Armadura" className="min-w-48 flex-1">
            <select aria-label="Armadura" disabled={readOnly} value={build.armor} onChange={(e) => setBuild({ armor: e.target.value })} className={select}>
              {ARMORS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                  {a.category !== "none" ? ` (${ARMOR_CATEGORY_LABEL[a.category]}, ${a.base}${a.dexCap === 0 ? "" : a.dexCap ? " + DES máx. 2" : " + DES"})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex h-8 items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" disabled={readOnly} checked={build.shield} onChange={(e) => setBuild({ shield: e.target.checked })} className="accent-[var(--color-accent-solid)]" />
            <Shield className="size-3.5" /> Escudo (+2)
          </label>
        </div>
        {ac.untrained && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5" /> {cls?.label} não tem treinamento com essa proteção: desvantagem em testes de FOR e DES e não conjura magias.
          </p>
        )}
        {sheet.combat.defense !== null && <p className="mt-2 text-xs text-fg-subtle">A CA da aba Combate está fixa em {sheet.combat.defense}; deixe-a em automático para usar a armadura.</p>}

        <div className="mt-3 border-t border-line pt-3">
          <Switch
            checked={build.auto}
            disabled={readOnly}
            onChange={(auto) => setBuild({ auto })}
            label="Cálculo automático"
            description="PV máximos, dados de vida e espaços de magia seguem classe, nível e Constituição."
          />
        </div>
      </SheetSection>

      <SheetSection title="Testes de resistência">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ABILITIES.map((a) => {
            const pro = saveProficient(sheet, a);
            return (
              <div key={a} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
                <span className={cn("size-2 shrink-0 rounded-full", pro ? "bg-accent" : "border border-line")} title={pro ? "Proficiente (classe)" : "Sem proficiência"} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold text-accent">{ABILITY_ABBR[a]}</p>
                  <p className="truncate text-xs text-fg-muted">{ABILITY_LABEL[a]}</p>
                </div>
                <span className="font-mono text-sm tabular-nums">{signed(saveBonus(system, sheet, level, a))}</span>
                <RollButton label={`resistência de ${ABILITY_LABEL[a]}`} onClick={() => onCheck({ attributeKey: a, save: true })} />
              </div>
            );
          })}
        </div>
        {!cls && <p className="mt-2 text-xs text-fg-subtle">Escolha a classe para marcar as resistências proficientes.</p>}
      </SheetSection>

      {casting && (
        <SheetSection title="Conjuração">
          <div className="flex flex-wrap items-center gap-2">
            <Stat label="Atributo" value={ABILITY_ABBR[casting.ability]} />
            <Stat label="CD de magia" value={casting.dc} hint="8 + proficiência + modificador" />
            <Stat label="Ataque mágico" value={signed(casting.attack)} />
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {casting.slots.some((n) => n > 0) ? (
                casting.slots.map((n, i) =>
                  n > 0 ? (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted">
                      <Sparkles className="size-3 text-accent" /> {i + 1}º: {n}
                    </span>
                  ) : null,
                )
              ) : (
                <span className="text-xs text-fg-subtle">Espaços de magia a partir do nível 2.</span>
              )}
            </div>
          </div>
          {casting.pact && <p className="mt-2 text-xs text-fg-subtle">Magia de pacto: os espaços voltam num descanso curto.</p>}
        </SheetSection>
      )}

      {(race || cls) && (
        <SheetSection title="Traços e características">
          <div className="grid gap-2 sm:grid-cols-2">
            {race && <TraitList title={race.label} traits={race.traits} />}
            {cls && <TraitList title={`${cls.label} (nível 1)`} traits={cls.features} />}
          </div>
        </SheetSection>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] text-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-lg border border-line bg-surface-2/40 px-2 py-1.5" title={hint}>
      <span className="font-mono text-lg font-semibold tabular-nums leading-tight">{value}</span>
      <span className="truncate text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
    </div>
  );
}

function TraitList({ title, traits }: { title: string; traits: Trait[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/30 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg">
        <BookOpen className="size-3.5 text-accent" /> {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {traits.map((t) => (
          <li key={t.name} className="text-xs text-fg-muted">
            <span className="font-medium text-fg">{t.name}.</span> {t.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}
