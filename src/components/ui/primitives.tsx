import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/* ---------- Card ---------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted [&_svg]:size-4">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "system";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-fg-muted border-line",
  accent: "bg-accent/12 text-accent border-accent/25",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  info: "bg-info/12 text-info border-info/25",
  system: "bg-system/12 text-system border-system/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Marks a control or section as a planned feature (rule: never fake working features). */
export function PhaseBadge({ phase, className }: { phase: number; className?: string }) {
  return (
    <Badge tone="neutral" className={cn("font-mono text-[10px] uppercase tracking-wide", className)}>
      Fase {phase}
    </Badge>
  );
}

/* ---------- Avatar ---------- */

const AVATAR_SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

export function Avatar({
  name,
  color,
  src,
  size = "md",
  className,
  ring,
}: {
  name: string;
  color?: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
  ring?: boolean;
}) {
  const style: CSSProperties = {
    background: src ? undefined : `linear-gradient(135deg, ${color ?? "oklch(0.5 0.05 270)"}, color-mix(in oklch, ${color ?? "oklch(0.5 0.05 270)"} 55%, black))`,
  };
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white/95",
        AVATAR_SIZES[size],
        ring && "ring-2 ring-canvas",
        className,
      )}
      style={style}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-provided avatars from arbitrary storage URLs
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
}: {
  people: { id: string; name: string; color?: string; avatarUrl?: string | null }[];
  max?: number;
  size?: "xs" | "sm";
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} src={p.avatarUrl} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-surface-3 font-medium text-fg-muted ring-2 ring-canvas",
            AVATAR_SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ---------- Progress / resource bar ---------- */

export function ResourceBar({
  value,
  max,
  color,
  label,
  className,
  showValue = true,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
  className?: string;
  showValue?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-[11px]">
          {label && <span className="text-fg-subtle">{label}</span>}
          {showValue && (
            <span className="font-mono tabular-nums text-fg-muted">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--color-surface-2)_0%,var(--color-surface-3)_50%,var(--color-surface-2)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

/* ---------- Section header ---------- */

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-mono text-[10px] text-fg-muted">
      {children}
    </kbd>
  );
}
