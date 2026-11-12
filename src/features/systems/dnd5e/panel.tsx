"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Plus, Shield, Sparkles, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { RollButton, SheetSection } from "@/features/character-sheet/components/sheet-sections";
import { autoDerived } from "@/features/systems/rules/build";
import type { PanelProps } from "@/features/systems/rules/types";
import { addSpell, addWeapon, armorClass, changeClass, changeRace, dndOf, dndRules, emptyBuild, spellcasting, withDnd, type DndBuild } from "./rules";
import { featuresUpTo, SPELLS, WEAPONS, weaponProficient } from "./srd-extra";
import { ABILITY_ABBR, ARMOR_CATEGORY_LABEL, ARMORS, BACKGROUNDS, CLASSES, classByKey, RACES, raceByKey, type Trait } from "./srd";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const select =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60 disabled:opacity-70";

/**
 * D&D 5e (SRD 5.1): race, class, background and armor, and what follows from
 * them — armor class, saving throws, passive perception, hit die and spellcasting.
 */
export function DndPanel({ system, sheet, readOnly, update, onCheck, level }: PanelProps) {
  const build = dndOf(sheet) ?? emptyBuild();
  const cls = classByKey(build.class);
  const race = raceByKey(build.race);
  const ac = armorClass(sheet);
  const casting = spellcasting(system, sheet, level);
  const setBuild = (patch: Partial<DndBuild>) => update((s) => withDnd(s, patch));

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
          {dndRules.derived(system, sheet, level).map((d) => (
            <Stat key={d.key} label={d.label} value={d.value} hint={d.hint} />
          ))}
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
            checked={autoDerived(sheet)}
            disabled={readOnly}
            onChange={(on) => update((s) => ({ ...s, autoDerived: on }))}
            label="Cálculo automático"
            description="PV máximos, dados de vida e espaços de magia seguem classe, nível e Constituição."
          />
        </div>
      </SheetSection>

      <SheetSection title="Testes de resistência">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dndRules.saves!(system, sheet, level).map((save) => (
            <div key={save.key} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
              <span className={cn("size-2 shrink-0 rounded-full", save.proficient ? "bg-accent" : "border border-line")} title={save.proficient ? "Proficiente (classe)" : "Sem proficiência"} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-accent">{ABILITY_ABBR[save.key as keyof typeof ABILITY_ABBR]}</p>
                <p className="truncate text-xs text-fg-muted">{save.label}</p>
              </div>
              <span className="font-mono text-sm tabular-nums">{signed(save.value)}</span>
              <RollButton label={`resistência de ${save.label}`} onClick={() => onCheck(save.request)} />
            </div>
          ))}
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

      {!readOnly && <SrdPicker sheet={sheet} update={update} classKey={build.class} casting={!!casting} />}

      {(race || cls) && (
        <SheetSection title="Traços e características">
          <div className="grid gap-2 sm:grid-cols-2">
            {race && <TraitList title={race.label} traits={race.traits} />}
            {cls && <TraitList title={`${cls.label} (nível 1)`} traits={cls.features} />}
          </div>
          {cls && featuresUpTo(cls.key, Math.max(1, level ?? 1)).length > 0 && (
            <div className="mt-2 rounded-lg border border-line bg-surface-2/30 p-3">
              <p className="mb-1.5 text-xs font-medium text-fg">Ganhos até o nível {Math.max(1, level ?? 1)}</p>
              <ul className="flex flex-wrap gap-1.5">
                {featuresUpTo(cls.key, Math.max(1, level ?? 1)).map((f) => (
                  <li key={`${f.level}-${f.name}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted">
                    <span className="font-mono text-fg-subtle">{f.level}º</span> {f.name}
                  </li>
                ))}
              </ul>
              {(level ?? 1) > 5 && <p className="mt-1.5 text-[11px] text-fg-subtle">Do 6º nível em diante, anote as características na aba Habilidades.</p>}
            </div>
          )}
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

/** Weapons and spells from the SRD, added to the sheet in one click. */
function SrdPicker({ sheet, update, classKey, casting }: Pick<PanelProps, "sheet" | "update"> & { classKey: string; casting: boolean }) {
  const [weapon, setWeapon] = useState(WEAPONS[0].key);
  const spells = SPELLS.filter((s) => s.classes.includes(classKey));
  const chosen = WEAPONS.find((w) => w.key === weapon)!;
  return (
    <SheetSection title="Armas e magias do SRD">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Arma" className="min-w-56 flex-1">
          <select aria-label="Arma do SRD" value={weapon} onChange={(e) => setWeapon(e.target.value)} className={select}>
            {(["simples", "marcial"] as const).map((cat) => (
              <optgroup key={cat} label={cat === "simples" ? "Simples" : "Marciais"}>
                {WEAPONS.filter((w) => w.category === cat).map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label} · {w.dice} {w.damageType}
                    {weaponProficient(classKey || undefined, w) ? "" : " (sem proficiência)"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Button size="sm" variant="secondary" onClick={() => update((s) => addWeapon(s, chosen))} leadingIcon={<Swords className="size-3.5" />}>
          Adicionar ataque
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-fg-subtle">{chosen.properties.length ? chosen.properties.join(", ") : "Sem propriedades especiais"}. O ataque vai para a aba Combate.</p>

      {casting && spells.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-fg-muted">Truques e magias de 1º nível da classe</p>
          <div className="flex flex-wrap gap-1.5">
            {spells.map((s) => {
              const has = sheet.abilities.some((a) => a.name === s.label);
              return (
                <button
                  key={s.label}
                  type="button"
                  disabled={has}
                  onClick={() => update((sh) => addSpell(sh, s))}
                  title={`${s.level === 0 ? "Truque" : "1º nível"} · ${s.school}`}
                  className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors", has ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-fg-muted hover:text-fg")}
                >
                  {has ? <Sparkles className="size-3 text-accent" /> : <Plus className="size-3" />}
                  {s.label}
                  {s.level === 0 && <span className="text-[10px] text-fg-subtle">truque</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-fg-subtle">Entram em Habilidades. Magias de nível mais alto você anota lá.</p>
        </div>
      )}
    </SheetSection>
  );
}
