import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, icsDataUrl, sessionEvent } from "@/lib/calendar";
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
  calendar,
}: {
  session: GameSession;
  campaignName?: string;
  campaignId?: string;
  system?: SystemSummary;
  showSummary?: boolean;
  /** Offers "add to calendar" for a scheduled session (rows that aren't links themselves). */
  calendar?: { campaignName: string; url?: string };
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
      {calendar && !campaignId && session.status === "scheduled" && <AddToCalendar session={session} {...calendar} />}
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

function AddToCalendar({ session, campaignName, url }: { session: GameSession; campaignName: string; url?: string }) {
  const event = sessionEvent(session, campaignName, url);
  const link = "inline-flex h-7 items-center rounded-md px-2 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg";
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label="Adicionar à agenda">
      <CalendarPlus className="size-3.5 text-fg-subtle" aria-hidden />
      <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={link} title="Adicionar ao Google Agenda">
        Google
      </a>
      <a href={icsDataUrl(event)} download={`sessao-${session.number}.ics`} className={link} title="Baixar para a agenda do celular ou do Outlook (.ics)">
        .ics
      </a>
    </div>
  );
}
