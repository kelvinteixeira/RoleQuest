"use client";

import type { ReactNode } from "react";
import { Dices, Lock, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ResourceBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { CharacterSheet, CustomFieldValue } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { attributeModifier, carriedWeight, newAbility, newItem, usesScoreModifier } from "../model/sheet";
import { skillUsesAttribute, type CheckRequest } from "../model/checks";
import { classOf, growthHint } from "@/features/systems/rules/generic";
import { autoDerived } from "@/features/systems/rules/build";

export interface SectionProps {
  system: SystemTemplate;
  sheet: CharacterSheet;
  readOnly: boolean;
  update: (fn: (sheet: CharacterSheet) => CharacterSheet) => void;
  onCheck: (req: CheckRequest) => void;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/* ---------- Small controls ---------- */

export function NumberField({
  value,
  onChange,
  min,
  max,
  readOnly,
  className,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  readOnly?: boolean;
  className?: string;
  label: string;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      readOnly={readOnly}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
      }}
      className={cn(
        "h-8 w-14 rounded-md border border-line bg-surface-2/60 text-center font-mono text-sm tabular-nums text-fg outline-none focus:border-accent/60 read-only:opacity-70",
        className,
      )}
    />
  );
}

export function RollButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Rolar ${label}`}
      title={`Rolar ${label}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent/15 hover:text-accent"
    >
      <Dices className="size-4" />
    </button>
  );
}

export function SheetSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export const textInput =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none focus:border-accent/60 read-only:opacity-70";

/* ---------- Attributes, resources, conditions ---------- */

export function AttributesSection({ system, sheet, readOnly, update, onCheck }: SectionProps) {
  const cls = classOf(system, sheet);
  const grows = !!cls?.resourceGrowth && Object.keys(cls.resourceGrowth).length > 0;
  const groups = system.attributes.reduce<Record<string, typeof system.attributes>>((acc, a) => {
    (acc[a.group ?? "Atributos"] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groups).map(([group, attrs]) => (
        <SheetSection key={group} title={group}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attrs.map((a) => {
              const value = sheet.attributes[a.key] ?? a.defaultValue;
              return (
                <div key={a.key} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-accent">{a.abbreviation}</p>
                    <p className="truncate text-xs text-fg-muted">{a.label}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <NumberField
                      label={a.label}
                      value={value}
                      min={a.min}
                      max={a.max}
                      readOnly={readOnly}
                      onChange={(v) => update((s) => ({ ...s, attributes: { ...s.attributes, [a.key]: v } }))}
                    />
                    {usesScoreModifier(a) && <span className="mt-0.5 font-mono text-[11px] text-fg-subtle">{signed(attributeModifier(a, value))}</span>}
                  </div>
                  <RollButton label={a.label} onClick={() => onCheck({ attributeKey: a.key })} />
                </div>
              );
            })}
          </div>
        </SheetSection>
      ))}

      <SheetSection
        title="Recursos"
        action={
          grows && (
            <label className="flex items-center gap-1.5 text-[11px] text-fg-subtle" title="Os máximos seguem a classe e o nível">
              <input type="checkbox" disabled={readOnly} checked={autoDerived(sheet)} onChange={(e) => update((s) => ({ ...s, autoDerived: e.target.checked }))} className="accent-[var(--color-accent-solid)]" />
              Automático pela classe
            </label>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {system.resources.map((r) => {
            const classHint = cls ? growthHint(system, cls, r.key) : null;
            const res = sheet.resources[r.key] ?? { current: r.defaultMax, max: r.defaultMax };
            const set = (patch: Partial<typeof res>) =>
              update((s) => {
                const next = { ...res, ...patch };
                next.max = Math.max(0, next.max);
                next.current = Math.max(0, Math.min(next.max, next.current));
                return { ...s, resources: { ...s.resources, [r.key]: next } };
              });
            return (
              <div key={r.key} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <ResourceBar label={r.label} value={res.current} max={res.max} color={r.color} />
                  {classHint ? (
                    <p className="mt-0.5 text-[10px] text-fg-subtle">
                      {cls!.label}: {classHint}
                    </p>
                  ) : (
                    r.derivedFrom && <p className="mt-0.5 text-[10px] text-fg-subtle">{r.derivedFrom}</p>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Diminuir ${r.label}`} onClick={() => set({ current: res.current - 1 })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Aumentar ${r.label}`} onClick={() => set({ current: res.current + 1 })}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-fg-subtle">
                  <NumberField label={`${r.label} atual`} value={res.current} min={0} readOnly={readOnly} onChange={(v) => set({ current: v })} className="w-12" />/
                  <NumberField label={`${r.label} máximo`} value={res.max} min={0} readOnly={readOnly} onChange={(v) => set({ max: v })} className="w-12" />
                </div>
              </div>
            );
          })}
        </div>
      </SheetSection>

      <SheetSection title="Condições">
        <div className="flex flex-wrap gap-1.5">
          {system.conditions.map((c) => {
            const on = sheet.conditions.includes(c.label);
            return (
              <button
                key={c.key}
                type="button"
                disabled={readOnly}
                title={c.description}
                aria-pressed={on}
                onClick={() => update((s) => ({ ...s, conditions: on ? s.conditions.filter((x) => x !== c.label) : [...s.conditions, c.label] }))}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-default",
                  on ? "border-danger/50 bg-danger/12 text-danger" : "border-line text-fg-muted enabled:hover:text-fg",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </SheetSection>
    </div>
  );
}

/* ---------- Skills ---------- */

export function SkillsSection({ system, sheet, readOnly, update, onCheck }: SectionProps) {
  if (system.skills.length === 0) {
    return <p className="text-sm text-fg-subtle">Este sistema não define perícias. O editor de sistemas próprios (Fase 2) permitirá criá-las.</p>;
  }
  const percent = system.dice.mechanic === "d100-roll-under";
  const bonusLabel = percent ? "%" : system.dice.mechanic === "d10-dice-pool" ? "pontos" : "bônus";
  return (
    <SheetSection title={`Perícias (${system.skills.length})`}>
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        {system.skills.map((s) => {
          const value = sheet.skills[s.key] ?? { trained: false, bonus: 0 };
          const chooseAttr = skillUsesAttribute(system) && !s.attributeKey;
          const attr = system.attributes.find((a) => a.key === (value.attribute ?? s.attributeKey ?? (chooseAttr ? system.attributes[0]?.key : undefined)));
          const set = (patch: Partial<typeof value>) => update((sh) => ({ ...sh, skills: { ...sh.skills, [s.key]: { ...value, ...patch } } }));
          return (
            <div key={s.key} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2/50">
              {!percent && (
                <input
                  type="checkbox"
                  checked={value.trained}
                  disabled={readOnly}
                  onChange={(e) => set({ trained: e.target.checked })}
                  aria-label={`${s.label} treinada`}
                  className="accent-[var(--color-accent-solid)]"
                />
              )}
              <span className={cn("min-w-0 flex-1 truncate text-sm", value.trained ? "text-fg" : "text-fg-muted")}>{s.label}</span>
              {chooseAttr ? (
                <select
                  aria-label={`Atributo de ${s.label}`}
                  disabled={readOnly}
                  value={attr?.key ?? ""}
                  onChange={(e) => set({ attribute: e.target.value })}
                  className="h-7 rounded-md border border-line bg-surface-2/60 px-1 font-mono text-[10px] text-fg-muted outline-none"
                >
                  {system.attributes.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.abbreviation}
                    </option>
                  ))}
                </select>
              ) : (
                attr && <span className="font-mono text-[10px] text-fg-subtle">{attr.abbreviation}</span>
              )}
              <NumberField label={`${s.label} ${bonusLabel}`} value={value.bonus} min={percent ? 0 : -20} max={percent ? 99 : 50} readOnly={readOnly} onChange={(v) => set({ bonus: v })} className="w-12" />
              <RollButton label={s.label} onClick={() => onCheck({ skillKey: s.key })} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-fg-subtle">{percent ? "Valor em % usado como alvo do teste." : `Marque as treinadas; "${bonusLabel}" soma ao teste.`}</p>
    </SheetSection>
  );
}

/* ---------- Abilities ---------- */

export function AbilitiesSection({ system, sheet, readOnly, update }: SectionProps) {
  const setAbility = (id: string, patch: Partial<CharacterSheet["abilities"][number]>) =>
    update((s) => ({ ...s, abilities: s.abilities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  return (
    <SheetSection
      title={system.abilitiesLabel}
      action={
        !readOnly && (
          <Button size="sm" variant="secondary" leadingIcon={<Plus className="size-3.5" />} onClick={() => update((s) => ({ ...s, abilities: [...s.abilities, newAbility()] }))}>
            Adicionar
          </Button>
        )
      }
    >
      {sheet.abilities.length === 0 ? (
        <p className="text-sm text-fg-subtle">Nenhuma habilidade ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sheet.abilities.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-surface-2/40 p-3">
              <div className="flex gap-2">
                <input aria-label="Nome" readOnly={readOnly} value={a.name} onChange={(e) => setAbility(a.id, { name: e.target.value })} className={cn(textInput, "font-medium")} />
                <input aria-label="Tipo" readOnly={readOnly} placeholder="Tipo" value={a.kind} onChange={(e) => setAbility(a.id, { kind: e.target.value })} className={cn(textInput, "w-28 flex-none")} />
                <input aria-label="Custo" readOnly={readOnly} placeholder="Custo" value={a.cost} onChange={(e) => setAbility(a.id, { cost: e.target.value })} className={cn(textInput, "w-24 flex-none")} />
                {!readOnly && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remover ${a.name}`} onClick={() => update((s) => ({ ...s, abilities: s.abilities.filter((x) => x.id !== a.id) }))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <textarea
                aria-label="Descrição"
                readOnly={readOnly}
                placeholder="O que faz, alcance, duração…"
                value={a.description}
                onChange={(e) => setAbility(a.id, { description: e.target.value })}
                rows={2}
                className="mt-2 w-full resize-y rounded-md border border-line bg-surface-2/60 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/60"
              />
            </li>
          ))}
        </ul>
      )}
    </SheetSection>
  );
}

/* ---------- Inventory ---------- */

export function InventorySection({ system, sheet, readOnly, update }: SectionProps) {
  const setItem = (id: string, patch: Partial<CharacterSheet["inventory"][number]>) =>
    update((s) => ({ ...s, inventory: s.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const slots = system.inventory.equipmentSlots;
  return (
    <div className="flex flex-col gap-4">
      <SheetSection
        title="Itens"
        action={
          !readOnly && (
            <Button size="sm" variant="secondary" leadingIcon={<Plus className="size-3.5" />} onClick={() => update((s) => ({ ...s, inventory: [...s.inventory, newItem()] }))}>
              Adicionar item
            </Button>
          )
        }
      >
        {sheet.inventory.length === 0 ? (
          <p className="text-sm text-fg-subtle">Inventário vazio.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sheet.inventory.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2/30 p-2">
                <label className="flex items-center gap-1 text-[11px] text-fg-subtle" title="Equipado">
                  <input type="checkbox" checked={i.equipped} disabled={readOnly} onChange={(e) => setItem(i.id, { equipped: e.target.checked })} className="accent-[var(--color-accent-solid)]" />
                  equip.
                </label>
                <input aria-label="Item" readOnly={readOnly} value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} className={cn(textInput, "min-w-32 flex-1")} />
                <NumberField label="Quantidade" value={i.quantity} min={0} readOnly={readOnly} onChange={(v) => setItem(i.id, { quantity: v })} className="w-12" />
                {system.inventory.model !== "list" && (
                  <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
                    <NumberField label="Peso" value={i.weight} min={0} readOnly={readOnly} onChange={(v) => setItem(i.id, { weight: v })} className="w-14" />
                    {system.inventory.model === "slots" ? "esp." : "kg"}
                  </span>
                )}
                {slots.length > 0 && (
                  <select
                    aria-label="Slot"
                    disabled={readOnly}
                    value={i.slot ?? ""}
                    onChange={(e) => setItem(i.id, { slot: e.target.value || null, equipped: e.target.value ? true : i.equipped })}
                    className="h-8 rounded-md border border-line bg-surface-2/60 px-1 text-xs text-fg outline-none"
                  >
                    <option value="">Sem slot</option>
                    {slots.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
                {!readOnly && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remover ${i.name}`} onClick={() => update((s) => ({ ...s, inventory: s.inventory.filter((x) => x.id !== i.id) }))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {system.inventory.model !== "list" && (
          <p className="mt-3 text-xs text-fg-subtle">
            Carga: <span className="font-mono text-fg-muted">{carriedWeight(sheet.inventory)}</span> · {system.inventory.capacityLabel}
          </p>
        )}
      </SheetSection>

      <SheetSection title="Moedas e recursos">
        <div className="flex flex-wrap gap-3">
          {system.inventory.currencies.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-fg-muted">
              {c}
              <NumberField label={c} value={sheet.currency[c] ?? 0} min={0} readOnly={readOnly} onChange={(v) => update((s) => ({ ...s, currency: { ...s.currency, [c]: v } }))} className="w-20" />
            </label>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}

/* ---------- Custom fields ---------- */

export function CustomFieldsSection({ system, sheet, readOnly, update }: SectionProps) {
  if (system.customFields.length === 0) return <p className="text-sm text-fg-subtle">Este sistema não tem campos personalizados.</p>;
  const sections = system.customFields.reduce<Record<string, typeof system.customFields>>((acc, f) => {
    (acc[f.section] ??= []).push(f);
    return acc;
  }, {});
  const set = (key: string, value: CustomFieldValue) => update((s) => ({ ...s, custom: { ...s.custom, [key]: value } }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(sections).map(([section, fields]) => (
        <SheetSection key={section} title={section}>
          <div className="flex flex-col gap-3">
            {fields.map((f) => {
              const value = sheet.custom[f.key];
              return (
                <label key={f.key} className="flex flex-col gap-1 text-xs text-fg-subtle">
                  {f.label}
                  {f.type === "number" || f.type === "counter" ? (
                    <NumberField label={f.label} value={Number(value) || 0} readOnly={readOnly} onChange={(v) => set(f.key, v)} className="w-20" />
                  ) : f.type === "checkbox" ? (
                    <input type="checkbox" checked={!!value} disabled={readOnly} onChange={(e) => set(f.key, e.target.checked)} className="size-4 accent-[var(--color-accent-solid)]" />
                  ) : f.type === "select" ? (
                    <select disabled={readOnly} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} className="h-8 rounded-md border border-line bg-surface-2/60 px-2 text-sm text-fg outline-none">
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "list" || f.type === "textarea" ? (
                    <textarea
                      readOnly={readOnly}
                      rows={3}
                      placeholder={f.type === "list" ? "Um por linha" : ""}
                      value={Array.isArray(value) ? value.join("\n") : String(value ?? "")}
                      onChange={(e) => set(f.key, f.type === "list" ? e.target.value.split("\n") : e.target.value)}
                      className="resize-y rounded-md border border-line bg-surface-2/60 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/60"
                    />
                  ) : (
                    <input readOnly={readOnly} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} className={textInput} />
                  )}
                </label>
              );
            })}
          </div>
        </SheetSection>
      ))}
    </div>
  );
}

/* ---------- Story & private notes ---------- */

const STORY_FIELDS: { key: keyof CharacterSheet["story"]; label: string; placeholder: string }[] = [
  { key: "background", label: "Origem e histórico", placeholder: "De onde veio, o que fazia antes da aventura." },
  { key: "personality", label: "Personalidade", placeholder: "Traços, ideais, vínculos, defeitos." },
  { key: "appearance", label: "Aparência", placeholder: "Como os outros o veem." },
  { key: "relationships", label: "Relacionamentos", placeholder: "Aliados, rivais, família, dívidas." },
  { key: "history", label: "Biografia na campanha", placeholder: "O que já aconteceu desde a primeira sessão." },
];

export function StorySection({ sheet, readOnly, update, canSeePrivate }: SectionProps & { canSeePrivate: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {STORY_FIELDS.map((f) => (
        <SheetSection key={f.key} title={f.label}>
          <textarea
            readOnly={readOnly}
            rows={4}
            placeholder={f.placeholder}
            value={sheet.story[f.key]}
            onChange={(e) => update((s) => ({ ...s, story: { ...s.story, [f.key]: e.target.value } }))}
            className="w-full resize-y rounded-md border border-line bg-surface-2/60 px-3 py-2 text-sm leading-relaxed text-fg outline-none focus:border-accent/60"
          />
        </SheetSection>
      ))}
      {canSeePrivate && (
        <SheetSection
          title="Anotações privadas"
          action={
            <Badge>
              <Lock className="size-3" /> só você e o mestre
            </Badge>
          }
        >
          <textarea
            readOnly={readOnly}
            rows={4}
            placeholder="Segredos, planos, suspeitas."
            value={sheet.privateNotes}
            onChange={(e) => update((s) => ({ ...s, privateNotes: e.target.value }))}
            className="w-full resize-y rounded-md border border-line bg-surface-2/60 px-3 py-2 text-sm leading-relaxed text-fg outline-none focus:border-accent/60"
          />
        </SheetSection>
      )}
    </div>
  );
}
