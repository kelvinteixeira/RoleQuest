import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-fg-subtle [&_svg]:size-5">
          {icon}
        </span>
      )}
      <div className="max-w-sm">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="mt-1 text-sm text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-danger/25 bg-danger/5 px-6 py-10 text-center", className)}
    >
      <AlertTriangle className="size-5 text-danger" />
      <p className="text-sm text-fg">{toUserMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leadingIcon={<RotateCcw className="size-3.5" />}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Carregando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-sm text-fg-subtle", className)} role="status">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
