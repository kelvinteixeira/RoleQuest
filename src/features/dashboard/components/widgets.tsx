"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CalendarClock, Check, Crown, DoorOpen, Mail, Map as MapIcon, Package, UsersRound, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { AvatarStack, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CampaignCover } from "@/features/campaigns/components/campaign-card";
import { SessionRow } from "@/features/campaigns/components/session-row";
import { SystemEmblem, SystemTag } from "@/features/systems/components/system-identity";
import type { InviteModel } from "@/services/campaign.service";
import type { SessionWithCampaign } from "@/services/dashboard.service";
import type { SystemSummary } from "@/services/system.service";

export function StatTile({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) {
  return (
    <div className="surface-card flex items-center gap-4 p-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-fg-muted [&_svg]:size-[18px]">{icon}</span>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-medium tabular-nums leading-none text-fg">{value}</p>
        <p className="mt-1 truncate text-xs text-fg-subtle">
          {label}
          {hint && <span className="text-fg-subtle/70"> · {hint}</span>}
        </p>
      </div>
    </div>
  );
}

export function NextSessionHero({ item }: { item: SessionWithCampaign | undefined }) {
  if (!item) {
    return (
      <Card className="p-6">
        <EmptyState
          compact
          className="border-none"
          icon={<CalendarClock />}
          title="Nenhuma sessão agendada"
          description="Crie uma campanha ou peça ao mestre para marcar a próxima sessão."
          action={
            <ButtonLink href="/campaigns/new" size="sm">
              Criar campanha
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  const { session, campaign } = item;
  return (
    <section className="surface-card relative overflow-hidden">
      <CampaignCover model={campaign} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-canvas/95 via-canvas/75 to-canvas/20" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" dot>
            Próxima sessão · {formatRelative(session.scheduledAt)}
          </Badge>
          {campaign.role === "game_master" && (
            <Badge tone="neutral">
              <Crown className="size-3" /> Você é o mestre
            </Badge>
          )}
        </div>
        <div>
          <p className="text-sm text-fg-muted">{campaign.campaign.name}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-fg-subtle">#{session.number}</span> {session.title}
          </h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
            <CalendarClock className="size-4 text-accent" />
            {formatDateTime(session.scheduledAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarStack people={campaign.members.map((m) => ({ id: m.id, name: m.displayName, color: m.avatarColor, avatarUrl: m.avatarUrl }))} />
            <SystemTag theme={campaign.system.theme} label={campaign.system.shortName} />
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href={`/campaign/${campaign.campaign.id}`} variant="secondary" size="sm">
              Ver campanha
            </ButtonLink>
            <ButtonLink href={`/campaign/${campaign.campaign.id}/session`} size="sm" leadingIcon={<DoorOpen className="size-3.5" />}>
              {campaign.role === "game_master" ? "Iniciar sessão" : "Entrar na sala"}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function InvitesPanel({
  invites,
  respondingTo,
  onRespond,
}: {
  invites: InviteModel[];
  respondingTo: string | null;
  onRespond: (inviteId: string, accept: boolean, campaignName: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Convites recebidos"
        icon={<Mail />}
        action={invites.length > 0 ? <Badge tone="accent">{invites.length}</Badge> : undefined}
      />
      <div className="flex flex-col gap-3 p-5 pt-4">
        {invites.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nenhum convite pendente.</p>
        ) : (
          invites.map(({ invite, system }) => (
            <div key={invite.id} className="rounded-xl border border-line bg-surface-2/50 p-3.5">
              <div className="flex items-start gap-3">
                <SystemEmblem theme={system.theme} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invite.campaignName}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {invite.invitedByName} · {system.shortName} · {formatRelative(invite.createdAt)}
                  </p>
                </div>
              </div>
              {invite.message && <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">“{invite.message}”</p>}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  loading={respondingTo === invite.id}
                  disabled={respondingTo !== null}
                  leadingIcon={<Check className="size-3.5" />}
                  onClick={() => onRespond(invite.id, true, invite.campaignName)}
                >
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={respondingTo !== null}
                  leadingIcon={<X className="size-3.5" />}
                  onClick={() => onRespond(invite.id, false, invite.campaignName)}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function SessionListCard({
  title,
  icon,
  items,
  empty,
  showSummary,
}: {
  title: string;
  icon: ReactNode;
  items: SessionWithCampaign[];
  empty: string;
  showSummary?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <div className="flex flex-col gap-1 p-5 pt-3">
        {items.length === 0 ? (
          <p className="text-sm text-fg-subtle">{empty}</p>
        ) : (
          items.map(({ session, campaign }) => (
            <SessionRow
              key={session.id}
              session={session}
              campaignName={campaign.campaign.name}
              campaignId={campaign.campaign.id}
              system={campaign.system}
              showSummary={showSummary}
            />
          ))
        )}
      </div>
    </Card>
  );
}

export function SystemsStrip({ systems }: { systems: SystemSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {systems.map((s) => (
        <Link
          key={s.id}
          href={`/systems?system=${s.id}`}
          className="group surface-card flex items-center gap-3 p-3 transition-colors hover:border-line-strong"
        >
          <SystemEmblem theme={s.theme} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:text-fg">{s.shortName}</span>
            <span className="block truncate text-[11px] text-fg-subtle">{s.genres.join(" · ")}</span>
          </span>
        </Link>
      ))}
      <Link
        href="/systems?create=1"
        className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong p-3 text-fg-muted transition-colors hover:border-accent/50 hover:text-accent"
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-surface-2 text-sm">+</span>
        <span className="text-sm font-medium">Meu próprio sistema</span>
      </Link>
    </div>
  );
}

export function LibraryShortcuts({ counts }: { counts: { characters: number; scenarios: number; resources: number } }) {
  const items = [
    { href: "/characters", label: "Personagens", description: "Fichas prontas para entrar em qualquer mesa", count: counts.characters, icon: UsersRound },
    { href: "/library?tab=scenarios", label: "Cenários", description: "Mapas e ambientes reutilizáveis", count: counts.scenarios, icon: MapIcon },
    { href: "/library?tab=resources", label: "Recursos", description: "Tilesets, tokens, áudio e documentos", count: counts.resources, icon: Package },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(({ href, label, description, count, icon: Icon }) => (
        <Link key={href} href={href} className="group surface-card flex items-start gap-3 p-4 transition-colors hover:border-line-strong">
          <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-fg-muted group-hover:text-accent">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              {label}
              <span className="font-mono text-xs text-fg-subtle">{count}</span>
            </span>
            <span className="mt-0.5 block text-xs text-fg-subtle">{description}</span>
          </span>
          <ArrowUpRight className={cn("size-4 text-fg-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg")} />
        </Link>
      ))}
    </div>
  );
}
