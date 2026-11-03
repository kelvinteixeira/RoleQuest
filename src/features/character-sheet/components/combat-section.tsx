"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { attackStats, defenseHint, deriveDefense, deriveInitiative } from "@/features/combat/model/profile";
import { attackRuleHint, formatAttackValue, formatDefense, formatInitiative, isValidDamage, rulesFor } from "@/features/combat/model/rules";
import type { SheetAttack } from "@/types/character";
import { newAttack } from "../model/combat-defaults";
import { NumberField, SheetSection, textInput, type SectionProps } from "./sheet-sections";

const selectClass = "h-8 min-w-0 rounded-md border border-line bg-surface-2/60 px-1 text-xs text-fg outline-none disabled:opacity-70";

/** Defense, armor, speed and attacks: what the token uses in the game room. */
export function CombatSection({ system, sheet, readOnly, update, level }: SectionProps & { level: number | null }) {
  const rules = rulesFor(system);
  const combat = sheet.combat;
  const derived = deriveDefense(system, sheet);
  const auto = combat.defense === null;
  const initiative = deriveInitiative(system, sheet);
  const d20 = system.dice.mechanic === "d20-plus-modifier";
  const setCombat = (patch: Partial<typeof combat>) => update((s) => ({ ...s, combat: { ...s.combat, ...patch } }));
  const setAttack = (id: string, patch: Partial<SheetAttack>) => update((s) => ({ ...s, combat: { ...s.combat, attacks: s.combat.attacks.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }));
  const cell = system.combat.gridCellDistance;
  const unit = system.combat.distanceUnit === "squares" ? "□" : system.combat.distanceUnit;

  return (
    <div className="flex flex-col gap-4">
      <SheetSection title="Defesa e movimento">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{system.combat.defenseLabel}</p>
              <label className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={readOnly}
                  onChange={(e) => setCombat({ defense: e.target.checked ? null : derived })}
                  className="accent-[var(--color-accent-solid)]"
                />
                automática
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {auto ? (
                <span className="font-mono text-xl font-semibold text-accent">{formatDefense(rules, derived)}</span>
              ) : (
                <NumberField label={system.combat.defenseLabel} value={combat.defense ?? derived} min={0} readOnly={readOnly} onChange={(v) => setCombat({ defense: v })} className="w-16" />
              )}
            </div>
            <p className="mt-1 text-[11px] text-fg-subtle">{auto ? defenseHint(system) : `Valor manual (automático seria ${formatDefense(rules, derived)}).`}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2/40 p-3 text-sm">
              Armadura
              <NumberField label="Armadura" value={combat.armor} min={0} max={99} readOnly={readOnly} onChange={(v) => setCombat({ armor: v })} />
              <span className="text-[11px] text-fg-subtle">reduz o dano</span>
            </label>
            <label className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2/40 p-3 text-sm">
              Deslocamento
              <NumberField label="Deslocamento" value={combat.speed} min={1} max={30} readOnly={readOnly} onChange={(v) => setCombat({ speed: v })} />
              <span className="text-[11px] text-fg-subtle">
                □/turno · {(combat.speed * cell).toLocaleString("pt-BR")} {unit}
              </span>
            </label>
          </div>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Iniciativa: <span className="font-mono text-fg-muted">{formatInitiative(rules, { initiative: initiative.value, initiativeDice: initiative.dice })}</span> · {system.combat.initiativeFormula}
        </p>
      </SheetSection>

      <SheetSection
        title={`Ataques (${combat.attacks.length})`}
        action={
          !readOnly && (
            <Button size="sm" variant="secondary" leadingIcon={<Plus className="size-3.5" />} onClick={() => setCombat({ attacks: [...combat.attacks, newAttack(system)] })}>
              Adicionar ataque
            </Button>
          )
        }
      >
        {combat.attacks.length === 0 ? (
          <p className="text-sm text-fg-subtle">Sem ataques: o personagem não poderá atacar na mesa.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {combat.attacks.map((a) => {
              const stats = attackStats(system, sheet, level, a);
              const damageOk = isValidDamage(stats.damage);
              return (
                <li key={a.id} className="rounded-lg border border-line bg-surface-2/40 p-3">
                  <div className="flex items-center gap-2">
                    <input aria-label="Nome do ataque" readOnly={readOnly} value={a.name} onChange={(e) => setAttack(a.id, { name: e.target.value })} className={cn(textInput, "font-medium")} />
                    <Badge tone="accent">{formatAttackValue(rules, stats)}</Badge>
                    {!readOnly && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Remover ${a.name}`} onClick={() => setCombat({ attacks: combat.attacks.filter((x) => x.id !== a.id) })}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
                    <label className="flex items-center gap-1">
                      Atributo
                      <select aria-label="Atributo do ataque" disabled={readOnly} value={a.attributeKey ?? ""} onChange={(e) => setAttack(a.id, { attributeKey: e.target.value || null })} className={selectClass}>
                        <option value="">—</option>
                        {system.attributes.map((attr) => (
                          <option key={attr.key} value={attr.key}>
                            {attr.abbreviation}
                          </option>
                        ))}
                      </select>
                    </label>
                    {system.skills.length > 0 && (
                      <label className="flex items-center gap-1">
                        Perícia
                        <select aria-label="Perícia do ataque" disabled={readOnly} value={a.skillKey ?? ""} onChange={(e) => setAttack(a.id, { skillKey: e.target.value || null })} className={cn(selectClass, "max-w-36")}>
                          <option value="">—</option>
                          {system.skills.map((sk) => (
                            <option key={sk.key} value={sk.key}>
                              {sk.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {d20 && !a.skillKey && (
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={a.proficient} disabled={readOnly} onChange={(e) => setAttack(a.id, { proficient: e.target.checked })} className="accent-[var(--color-accent-solid)]" />
                        proficiente
                      </label>
                    )}
                    <label className="flex items-center gap-1">
                      Bônus
                      <NumberField label="Bônus de ataque" value={a.bonus} min={-50} max={99} readOnly={readOnly} onChange={(v) => setAttack(a.id, { bonus: v })} className="w-12" />
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
                    <label className="flex items-center gap-1">
                      Dano
                      <input
                        aria-label="Dano"
                        aria-invalid={!damageOk}
                        readOnly={readOnly}
                        value={a.damage}
                        placeholder="1d8+@mod"
                        onChange={(e) => setAttack(a.id, { damage: e.target.value })}
                        className={cn(textInput, "w-28 font-mono text-xs", !damageOk && "border-danger/60")}
                      />
                    </label>
                    <span className={cn("font-mono", damageOk ? "text-fg-muted" : "text-danger")}>{damageOk ? `= ${stats.damage}` : "fórmula inválida"}</span>
                    <label className="ml-auto flex items-center gap-1">
                      Alcance
                      <NumberField label="Alcance" value={a.range} min={1} max={60} readOnly={readOnly} onChange={(v) => setAttack(a.id, { range: v })} className="w-12" />□
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-fg-subtle">
          {attackRuleHint(rules)} No dano, <span className="font-mono">@mod</span> e <span className="font-mono">@value</span> somam o atributo do ataque. Alcance 1 = corpo a corpo.
        </p>
      </SheetSection>
    </div>
  );
}
