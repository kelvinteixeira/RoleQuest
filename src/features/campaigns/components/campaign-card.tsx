import Link from "next/link";
import { CalendarClock, Crown, History } from "lucide-react";
import { AvatarStack, Badge } from "@/components/ui/primitives";
import { CAMPAIGN_STATUS, getVisualStyle } from "@/constants/campaign";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { coverGradient, SystemGlyphIcon, SystemTag, systemStyle } from "@/features/systems/components/system-identity";
import type { CampaignCardModel } from "@/services/campaign.service";
import type { SystemTheme } from "@/types/system";

/** Cover art from a visual style + system theme. Also used for live previews of unsaved campaigns. */
export function CoverArt({ visualStyleId, theme, className }: { visualStyleId: string; theme: SystemTheme; className?: string }) {
  const style = getVisualStyle(visualStyleId);
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: coverGradient(style.gradient), ...systemStyle(theme) }}>
      <div className="bg-tabletop-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_top,transparent,black)]" />
      <SystemGlyphIcon glyph={theme.glyph} className="absolute -bottom-6 -right-4 size-28 rotate-[-12deg] text-system opacity-[0.16]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(1_0_0/0.08),transparent_55%)]" />
    </div>
  );
}

export function CampaignCover({ model, className }: { model: Pick<CampaignCardModel, "campaign" | "system">; className?: string }) {
  return <CoverArt visualStyleId={model.campaign.visualStyleId} theme={model.system.theme} className={className} />;
}

export function CampaignCard({ model, className }: { model: CampaignCardModel; className?: string }) {
  const { campaign, role, system, members, nextSession, completedSessions } = model;
  const status = CAMPAIGN_STATUS[campaign.status];

  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className={cn(
        "group surface-card flex flex-col overflow-hidden transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_12px_40px_-12px_oklch(0_0_0/0.6)]",
        className,
      )}
    >
      <div className="relative">
        <CampaignCover model={model} className="h-28" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <Badge tone={status.tone} dot className="bg-canvas/70 backdrop-blur">
            {status.label}
          </Badge>
          {role === "game_master" && (
            <Badge tone="accent" className="bg-canvas/70 backdrop-blur">
              <Crown className="size-3" /> Mestre
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-fg group-hover:text-accent">{campaign.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-fg-subtle">{campaign.tagline}</p>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-fg-muted">
            {nextSession ? (
              <>
                <CalendarClock className="size-3.5 text-accent" />
                <span>
                  Sessão {nextSession.number} · {formatDateTime(nextSession.scheduledAt)}
                </span>
              </>
            ) : campaign.lastPlayedAt ? (
              <>
                <History className="size-3.5" />
                <span>Última sessão {formatRelative(campaign.lastPlayedAt)}</span>
              </>
            ) : (
              <span className="text-fg-subtle">Nenhuma sessão agendada</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <SystemTag theme={system.theme} label={system.shortName} />
              <span className="truncate text-[11px] text-fg-subtle">{pluralize(completedSessions, "sessão", "sessões")}</span>
            </div>
            <AvatarStack people={members.map((m) => ({ id: m.id, name: m.displayName, color: m.avatarColor, avatarUrl: m.avatarUrl }))} size="xs" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      <div className="h-28 animate-pulse bg-surface-2" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
