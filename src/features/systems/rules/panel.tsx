"use client";

/**
 * The sheet block most systems use: the module's derived numbers, its saving
 * throws (with roll buttons), the "automático" switch and an optional extra
 * part of the system's own (damage track, cyberware, ranks…).
 */
import type { ComponentType } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { NumberField, RollButton, SheetSection } from "@/features/character-sheet/components/sheet-sections";
import type { CharacterSheet } from "@/types/character";
import { autoDerived } from "./build";
import { rulesFor } from "./registry";
import type { PanelProps } from "./types";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function makePanel(opts: {
  title: string;
  /** Under the numbers ("Fórmulas do sistema; números de classe vêm das classes cadastradas"). */
  note?: string;
  /** What the automatic switch keeps up to date; no switch when absent. */
  auto?: string;
  /** How save values read: a bonus (+3) or a target/pool (12). */
  saveStyle?: "bonus" | "value";
  Extra?: ComponentType<PanelProps>;
}): ComponentType<PanelProps> {
  function RulesPanel(props: PanelProps) {
    const { system, sheet, level, readOnly, update, onCheck } = props;
    const rules = rulesFor(system);
    const derived = rules.derived(system, sheet, level);
    const saves = rules.saves?.(system, sheet, level) ?? [];
    return (
      <div className="flex flex-col gap-4">
        <SheetSection title={opts.title}>
          {derived.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {derived.map((d) => (
                <div key={d.key} className="flex min-w-0 flex-col items-center rounded-lg border border-line bg-surface-2/40 px-2 py-1.5" title={d.hint}>
                  <span className="font-mono text-lg font-semibold tabular-nums leading-tight">{d.value}</span>
                  <span className="max-w-full truncate text-[10px] uppercase tracking-wide text-fg-subtle">{d.label}</span>
                </div>
              ))}
            </div>
          )}
          {opts.note && <p className="mt-2 text-xs text-fg-subtle">{opts.note}</p>}
          {opts.auto && (
            <div className="mt-3 border-t border-line pt-3">
              <Switch checked={autoDerived(sheet)} disabled={readOnly} onChange={(on) => update((s) => ({ ...s, autoDerived: on }))} label="Cálculo automático" description={opts.auto} />
            </div>
          )}
        </SheetSection>

        {saves.length > 0 && (
          <SheetSection title="Testes de resistência">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {saves.map((save) => (
                <div key={save.key} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
                  <span className={cn("size-2 shrink-0 rounded-full", save.proficient ? "bg-accent" : "border border-line")} title={save.proficient ? "Treinado" : "Sem treino"} />
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{save.label}</span>
                  <span className="font-mono text-sm tabular-nums">{opts.saveStyle === "value" ? save.value : signed(save.value)}</span>
                  <RollButton label={save.label} onClick={() => onCheck(save.request)} />
                </div>
              ))}
            </div>
          </SheetSection>
        )}

        {opts.Extra && <opts.Extra {...props} />}
      </div>
    );
  }
  return RulesPanel;
}

/** A panel extra with labelled number fields kept in the module's build (Defesa bonus, PV de classe…). */
export function makeNumberFields<T extends object>(
  title: string,
  fields: { key: keyof T & string; label: string; min?: number; max?: number }[],
  build: { read: (sheet: CharacterSheet) => T; write: (sheet: CharacterSheet, patch: Partial<T>) => CharacterSheet },
): ComponentType<PanelProps> {
  function NumberFields({ sheet, readOnly, update }: PanelProps) {
    const values = build.read(sheet) as Record<string, unknown>;
    return (
      <SheetSection title={title}>
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm text-fg-muted">
              <span className="min-w-0 flex-1">{f.label}</span>
              <NumberField
                label={f.label}
                value={Number(values[f.key] ?? 0)}
                readOnly={readOnly}
                min={f.min ?? -99}
                max={f.max ?? 999}
                onChange={(v) => update((s) => build.write(s, { [f.key]: v } as Partial<T>))}
              />
            </label>
          ))}
        </div>
      </SheetSection>
    );
  }
  return NumberFields;
}
