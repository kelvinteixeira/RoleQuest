"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-lg border bg-surface-2/60 px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors outline-none focus:border-accent/60 focus:bg-surface-2 focus:ring-2 focus:ring-accent/15 disabled:opacity-60";

type FieldShellProps = {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  optional?: boolean;
  className?: string;
};

export function FieldShell({ label, hint, error, id, children, optional, className }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline justify-between text-xs font-medium text-fg-muted">
          <span>{label}</span>
          {optional && <span className="text-[11px] font-normal text-fg-subtle">opcional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  leadingIcon?: ReactNode;
  containerClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  optional,
  leadingIcon,
  className,
  containerClassName,
  id,
  type,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldShell label={label} hint={hint} error={error} id={inputId} optional={optional} className={containerClassName}>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&_svg]:size-4">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            CONTROL,
            "h-10",
            leadingIcon && "pl-9",
            isPassword && "pr-10",
            error ? "border-danger/60" : "border-line",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-fg-subtle hover:text-fg"
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </FieldShell>
  );
}

type TextareaProps = ComponentProps<"textarea"> & {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  containerClassName?: string;
};

export function Textarea({ label, hint, error, optional, className, containerClassName, id, ...props }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={inputId} optional={optional} className={containerClassName}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "min-h-24 resize-y py-2.5 leading-relaxed", error ? "border-danger/60" : "border-line", className)}
        {...props}
      />
    </FieldShell>
  );
}

type SelectProps = ComponentProps<"select"> & {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  containerClassName?: string;
};

export function Select({ label, hint, error, className, containerClassName, id, children, ...props }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={inputId} className={containerClassName}>
      <select
        id={inputId}
        className={cn(CONTROL, "h-10 appearance-none pr-8", error ? "border-danger/60" : "border-line", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
