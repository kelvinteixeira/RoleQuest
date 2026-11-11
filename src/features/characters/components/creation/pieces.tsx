"use client";

/**
 * Building blocks of guided character creation, shared by every system's
 * flow: option cards, chips with a limit, a point-buy distributor and a
 * "hand out these values" assigner (standard arrays, rolled scores).
 */
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ScoreSlot {
  key: string;
  label: string;
  abbreviation: string;
}

/* ---------- Pure helpers ---------- */

/** Points spent with a cost table (value → cost); values outside the table cost nothing. */
export function pointsSpent(values: Record<string, number | undefined>, keys: string[], cost: Record<number, number>): number {
  return keys.reduce((sum, k) => sum + (cost[values[k] ?? Number.NaN] ?? 0), 0);
}

/** Every key has a value and the values use the pool exactly once each. */
export function poolAssigned(values: Record<string, number | undefined>, keys: string[], pool: number[]): boolean {
  const left = [...pool];
  for (const k of keys) {
    const i = typeof values[k] === "number" ? left.indexOf(values[k]!) : -1;
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

/** Hands out a pool by priority: the first key gets the highest value. */
export function assignByPriority(pool: number[], order: string[]): Record<string, number> {
  const sorted = [...pool].sort((a, b) => b - a);
  return Object.fromEntries(order.slice(0, sorted.length).map((k, i) => [k, sorted[i]]));
}

/* ---------- Components ---------- */

/** A selectable card (race, class, origin…). */
export function ChoiceCard({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children?: React.ReactNode }) {
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

export function Chip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
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

/** Pick up to `max` options as chips; `locked` ones show as already taken. */
export function ChipPicker<K extends string>({
  options,
  selected,
  max,
  onChange,
  labelOf,
  locked = [],
  blocked = [],
}: {
  options: readonly K[];
  selected: K[];
  max: number;
  onChange: (next: K[]) => void;
  labelOf: (key: K) => string;
  /** Shown on and not clickable (granted elsewhere). */
  locked?: readonly K[];
  /** Not available here (picked in another group). */
  blocked?: readonly K[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((k) => {
        const isLocked = locked.includes(k);
        const on = isLocked || selected.includes(k);
        const disabled = isLocked || (!on && (selected.length >= max || blocked.includes(k)));
        return (
          <Chip key={k} on={on} disabled={disabled} onClick={() => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k])}>
            {labelOf(k)}
          </Chip>
        );
      })}
    </div>
  );
}

/** A row per slot with its base value, an optional bonus and what it adds up to. */
function SlotRow({ slot, control, bonus, total }: { slot: ScoreSlot; control: React.ReactNode; bonus?: number; total?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-semibold text-accent">{slot.abbreviation}</p>
        <p className="truncate text-xs text-fg-muted">{slot.label}</p>
      </div>
      {control}
      <span className="w-8 text-center font-mono text-[11px] text-accent">{bonus ? `${bonus > 0 ? "+" : ""}${bonus}` : ""}</span>
      <span className="w-14 text-right font-mono text-sm tabular-nums">{total ?? "—"}</span>
    </div>
  );
}

/**
 * Point buy: each slot moves between `min` and `max`, and the total cost
 * (from `cost`) stays within `budget`.
 */
export function PointBuy({
  slots,
  values,
  onChange,
  min,
  max,
  cost,
  budget,
  bonuses = {},
  total,
}: {
  slots: ScoreSlot[];
  values: Record<string, number | undefined>;
  onChange: (values: Record<string, number>) => void;
  min: number;
  max: number;
  cost: Record<number, number>;
  budget: number;
  bonuses?: Record<string, number>;
  /** What the final value looks like ("16 (+3)"). */
  total: (value: number) => React.ReactNode;
}) {
  const keys = slots.map((s) => s.key);
  const spent = pointsSpent(values, keys, cost);
  const set = (key: string, v: number) => onChange({ ...Object.fromEntries(keys.map((k) => [k, values[k] ?? min])), [key]: v });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {slots.map((slot) => {
        const v = values[slot.key] ?? min;
        const next = v + 1;
        const canRaise = v < max && cost[next] !== undefined && spent - (cost[v] ?? 0) + cost[next] <= budget;
        return (
          <SlotRow
            key={slot.key}
            slot={slot}
            bonus={bonuses[slot.key]}
            total={total(v + (bonuses[slot.key] ?? 0))}
            control={
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Diminuir ${slot.label}`} disabled={v <= min} onClick={() => set(slot.key, v - 1)}>
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-6 text-center font-mono text-sm tabular-nums">{v}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Aumentar ${slot.label}`} disabled={!canRaise} onClick={() => set(slot.key, next)}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            }
          />
        );
      })}
    </div>
  );
}

/** Hands out a pool of values (a standard array, rolled scores), each value used once. */
export function ValueAssigner({
  slots,
  pool,
  values,
  onChange,
  bonuses = {},
  total,
}: {
  slots: ScoreSlot[];
  pool: number[];
  values: Record<string, number | undefined>;
  onChange: (values: Record<string, number | undefined>) => void;
  bonuses?: Record<string, number>;
  total: (value: number) => React.ReactNode;
}) {
  // Values still free for a slot: the pool minus what the other slots took.
  const available = (key: string) => {
    const left = [...pool];
    for (const s of slots) {
      if (s.key === key) continue;
      const i = typeof values[s.key] === "number" ? left.indexOf(values[s.key]!) : -1;
      if (i >= 0) left.splice(i, 1);
    }
    return [...new Set(left)].sort((a, b) => b - a);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {slots.map((slot) => {
        const v = values[slot.key];
        const options = [...new Set([...(v !== undefined ? [v] : []), ...available(slot.key)])].sort((a, b) => b - a);
        return (
          <SlotRow
            key={slot.key}
            slot={slot}
            bonus={bonuses[slot.key]}
            total={v !== undefined ? total(v + (bonuses[slot.key] ?? 0)) : undefined}
            control={
              <select
                aria-label={slot.label}
                value={v ?? ""}
                onChange={(e) => onChange({ ...values, [slot.key]: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 w-16 rounded-md border border-line bg-surface-2/60 px-1 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            }
          />
        );
      })}
    </div>
  );
}

/** A step's grid of option cards. */
export function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-3">{children}</div>;
}
