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

/** Each pool value is used at most once and all of them are placed; keys left out stay at 0. */
export function poolPlaced(values: Record<string, number | undefined>, pool: number[]): boolean {
  const left = [...pool];
  for (const v of Object.values(values)) {
    if (!v) continue;
    const i = left.indexOf(v);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return left.length === 0;
}

/**
 * Number inputs under a budget: each slot between `min` and `max` (in `step`s),
 * and `cost(key, value)` added up must stay within `budget` (GURPS costs per
 * attribute, Call of Cthulhu occupation points, Cyberpunk stat points…).
 */
export function NumberBudget({
  slots,
  values,
  onChange,
  min,
  max,
  step = 1,
  cost,
  budget,
  total,
  columns = 2,
}: {
  slots: ScoreSlot[];
  values: Record<string, number | undefined>;
  onChange: (values: Record<string, number>) => void;
  min: number | ((key: string) => number);
  max: number | ((key: string) => number);
  step?: number;
  /** What a value costs; `all` holds every slot's value (costs relative to another slot). */
  cost: (key: string, value: number, all: Record<string, number>) => number;
  budget: number;
  total?: (key: string, value: number) => React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const lo = (k: string) => (typeof min === "function" ? min(k) : min);
  const hi = (k: string) => (typeof max === "function" ? max(k) : max);
  const full = Object.fromEntries(slots.map((s) => [s.key, values[s.key] ?? lo(s.key)]));
  const spent = slots.reduce((sum, s) => sum + cost(s.key, full[s.key], full), 0);
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("text-xs", spent > budget ? "text-danger" : "text-fg-subtle")}>
        Pontos: {spent}/{budget}
      </p>
      <div className={cn("grid gap-2", columns === 1 ? "" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {slots.map((slot) => (
          <SlotRow
            key={slot.key}
            slot={slot}
            total={total?.(slot.key, full[slot.key])}
            control={
              <input
                type="number"
                aria-label={slot.label}
                value={full[slot.key]}
                min={lo(slot.key)}
                max={hi(slot.key)}
                step={step}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onChange({ ...full, [slot.key]: Math.max(lo(slot.key), Math.min(hi(slot.key), Math.round(n))) });
                }}
                className="h-8 w-16 rounded-md border border-line bg-surface-2/60 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
              />
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Places a pool of dots on some of the slots (Storyteller skills): each value once, the rest stay at 0. */
export function PoolPlacer({ slots, pool, values, onChange }: { slots: ScoreSlot[]; pool: number[]; values: Record<string, number | undefined>; onChange: (values: Record<string, number | undefined>) => void }) {
  const left = [...pool];
  for (const v of Object.values(values)) {
    const i = v ? left.indexOf(v) : -1;
    if (i >= 0) left.splice(i, 1);
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-fg-subtle">Falta colocar: {left.length ? [...left].sort((a, b) => b - a).join(", ") : "nada"}</p>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {slots.map((slot) => {
          const v = values[slot.key];
          const options = [...new Set([...(v ? [v] : []), ...left])].sort((a, b) => b - a);
          return (
            <label key={slot.key} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/40 px-2 py-1">
              <span className="truncate text-xs text-fg-muted">{slot.label}</span>
              <select
                aria-label={slot.label}
                value={v ?? 0}
                onChange={(e) => onChange({ ...values, [slot.key]: Number(e.target.value) || undefined })}
                className="h-7 w-14 rounded-md border border-line bg-surface-2/60 text-center font-mono text-sm text-fg outline-none focus:border-accent/60"
              >
                <option value={0}>0</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
