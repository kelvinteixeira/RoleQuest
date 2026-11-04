"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Small building blocks shared by the system editor sections. */

const CONTROL = "h-9 w-full rounded-lg border bg-surface-2/60 px-2.5 text-sm text-fg outline-none transition-colors focus:border-accent/60";

export function TextField({ label, value, onChange, error, placeholder, maxLength, className, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; maxLength?: number; className?: string; hint?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-fg-muted", className)}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} className={cn(CONTROL, error ? "border-danger" : "border-line")} />
      {error ? <span className="text-[11px] text-danger">{error}</span> : hint ? <span className="text-[11px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

/**
 * Number field that keeps what is typed ("-", empty) instead of snapping to 0;
 * incomplete values reach the draft as NaN and validation flags them.
 */
export function NumberField({ label, value, onChange, error, className, step }: { label: string; value: number | undefined; onChange: (v: number) => void; error?: string; className?: string; step?: number }) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? "" : String(value));
  // Follow changes made elsewhere (row removed, value reset) without fighting what is being typed.
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    const typed = text.trim() === "" || text === "-" ? Number.NaN : Number(text);
    if (!Object.is(typed, value)) setText(value === undefined || Number.isNaN(value) ? "" : String(value));
  }
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-fg-muted", className)}>
      {label}
      <input
        inputMode="decimal"
        value={text}
        step={step}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          setText(raw);
          onChange(raw.trim() === "" || raw === "-" ? Number.NaN : Number(raw));
        }}
        aria-invalid={!!error}
        className={cn(CONTROL, "font-mono", error ? "border-danger" : "border-line")}
      />
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </label>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, className }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-fg-muted", className)}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(CONTROL, "border-line")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Comma-separated list ("Ação, Movimento") edited as text, kept as an array. */
export function ListTextField({ label, value, onChange, hint, className }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; className?: string }) {
  const [text, setText] = useState(value.join(", "));
  const joined = value.join(", ");
  const [seen, setSeen] = useState(joined);
  if (seen !== joined) {
    setSeen(joined);
    const typed = text.split(",").map((x) => x.trim()).filter(Boolean).join(", ");
    if (typed !== joined) setText(joined);
  }
  return (
    <TextField
      label={label}
      value={text}
      hint={hint ?? "Separe por vírgulas."}
      className={className}
      onChange={(v) => {
        setText(v);
        onChange(v.split(",").map((x) => x.trim()).filter(Boolean));
      }}
    />
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent-solid)]" />
      {label}
    </label>
  );
}

/** Rows of a list with move up / down / remove, plus an "add" button. */
export function RowList<T>({
  items,
  onChange,
  render,
  onAdd,
  addLabel,
  itemLabel,
  itemKey,
  reorder = true,
  max,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode;
  onAdd: () => void;
  addLabel: string;
  itemLabel: (item: T) => string;
  /** Stable identity: fields keep typed text per row, so rows must not be keyed by position. */
  itemKey: (item: T, index: number) => string;
  reorder?: boolean;
  max?: number;
  empty?: string;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && empty && <p className="text-sm text-fg-subtle">{empty}</p>}
      {items.map((item, i) => (
        <div key={itemKey(item, i)} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/30 p-2.5">
          <div className="min-w-0 flex-1">{render(item, i, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          <div className="flex shrink-0 flex-col gap-0.5">
            {reorder && (
              <>
                <IconButton label={`Subir ${itemLabel(item)}`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton label={`Descer ${itemLabel(item)}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
              </>
            )}
            <IconButton label={`Remover ${itemLabel(item)}`} onClick={() => onChange(items.filter((_, j) => j !== i))} danger>
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        </div>
      ))}
      <Button size="sm" variant="ghost" className="self-start" onClick={onAdd} disabled={max !== undefined && items.length >= max} leadingIcon={<Plus className="size-3.5" />}>
        {addLabel}
      </Button>
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors disabled:opacity-30", danger ? "hover:text-danger" : "hover:text-fg")}>
      {children}
    </button>
  );
}
