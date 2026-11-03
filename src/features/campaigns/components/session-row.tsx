import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { systemStyle } from "@/features/systems/components/system-identity";
import type { GameSession } from "@/types/campaign";
import type { SystemSummary } from "@/services/system.service";

/** Compact session line with a calendar chip. Optionally links to its campaign. */
export function SessionRow({
  session,
  campaignName,
  campaignId,
  system,
  showSummary = false,
}: {
  session: GameSession;
  campaignName?: string;
  campaignId?: string;
  system?: SystemSummary;
  showSummary?: boolean;
}) {
  const date = new Date(session.scheduledAt);
  const content = (
    <>
      <div
        className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line bg-surface-2 py-1.5"
        style={system ? systemStyle(system.theme) : undefined}
      >
        <span className="text-[10px] uppercase text-system">{date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
        <span className="font-mono text-lg leading-none tabular-nums text-fg">{date.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          <span className="font-mono text-xs text-fg-subtle">#{session.number}</span> {session.title}
        </p>
        <p className="truncate text-xs text-fg-subtle">
          {campaignName && <span className="text-fg-muted">{campaignName} · </span>}
          {session.status === "completed" ? `${formatDate(session.scheduledAt)} · ${formatDuration(session.durationMinutes)}` : `${formatTime(session.scheduledAt)} · ${formatDuration(session.durationMinutes)}`}
        </p>
        {showSummary && session.summary && <p className="mt-1.5 line-clamp-2 text-xs text-fg-muted">{session.summary}</p>}
      </div>
    </>
  );

  const className = cn("flex items-start gap-3 rounded-lg p-2 -mx-2", campaignId && "transition-colors hover:bg-surface-2");
  return campaignId ? (
    <Link href={`/campaign/${campaignId}`} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
