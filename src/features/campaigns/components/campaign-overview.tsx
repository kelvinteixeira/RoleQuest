"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Film,
  Crown,
  DoorOpen,
  Globe2,
  History,
  MapPin,
  ScrollText,
  Settings2,
  Sparkles,
  Users,
  UserPlus,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, Card, CardHeader, ResourceBar, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import { PageContainer } from "@/components/layout/page-header";
import { CAMPAIGN_STATUS, NARRATION_STYLES } from "@/constants/campaign";
import { useAsync } from "@/hooks/use-async";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { campaignService, type CampaignOverview as Overview } from "@/services/campaign.service";
import { toSummary } from "@/services/system.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { SystemTag } from "@/features/systems/components/system-identity";
import { CampaignCover } from "./campaign-card";
import { SessionRow } from "./session-row";

export function CampaignOverview({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);

  if (status === "error" && !data) {
    return (
      <PageContainer>
        <BackLink />
        <ErrorState error={error} onRetry={reload} />
      </PageContainer>
    );
  }
  if (!data) return <OverviewSkeleton />;
  return <OverviewContent data={data} />;
}

function BackLink() {
  return (
    <Link href="/campaigns" className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
      <ArrowLeft className="size-4" /> Campanhas
    </Link>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  const { campaign, role, system, members, upcomingSessions, pastSessions } = data;
  const summary = toSummary(system);
  const status = CAMPAIGN_STATUS[campaign.status];
  const isGM = role === "game_master";
  const narration = NARRATION_STYLES.find((n) => n.id === campaign.gameMaster.narrationStyle);
  const next = upcomingSessions[0];

  return (
    <>
      <div className="relative">
        <CampaignCover model={{ campaign, system: summary }} className="h-56 sm:h-64" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />
        <PageContainer className="absolute inset-x-0 bottom-0 py-0 lg:py-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            <SystemTag theme={system.theme} label={system.name} />
            <Badge tone={isGM ? "accent" : "neutral"}>
              {isGM && <Crown className="size-3" />} {ROLE_LABEL[role]}
            </Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">{campaign.name}</h1>
          <p className="mt-2 max-w-2xl pb-2 text-sm text-fg-muted sm:text-base">{campaign.tagline}</p>
        </PageContainer>
      </div>

      <PageContainer className="pt-6 lg:pt-8">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <ButtonLink href={`/campaign/${campaign.id}/session`} leadingIcon={<DoorOpen className="size-4" />}>
            {isGM ? "Iniciar sessão" : "Entrar na sala"}
          </ButtonLink>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <ButtonLink href={`/campaign/${campaign.id}/characters`} variant="secondary" leadingIcon={<ScrollText className="size-4" />}>
            Fichas
          </ButtonLink>
          <ButtonLink href={`/campaign/${campaign.id}/journal`} variant="secondary" leadingIcon={<BookOpen className="size-4" />}>
            Diário
          </ButtonLink>
          {isGM && (
            <ButtonLink href={`/campaign/${campaign.id}/gm`} variant="secondary" leadingIcon={<Crown className="size-4" />}>
              Ferramentas do mestre
            </ButtonLink>
          )}
          {!isGM && (
            <ButtonLink href={`/campaign/${campaign.id}/episodes`} variant="secondary" leadingIcon={<Film className="size-4" />}>
              Episódios
            </ButtonLink>
          )}
          {isGM && (
            <ButtonLink href={`/campaign/${campaign.id}/chronicles`} variant="secondary" leadingIcon={<Clapperboard className="size-4" />}>
              Chronicles
            </ButtonLink>
          )}
          {isGM && can(role, "campaign:manage") && (
            <ButtonLink href={`/campaign/${campaign.id}/settings`} variant="ghost" leadingIcon={<Settings2 className="size-4" />}>
              Configurar
            </ButtonLink>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader title="Mundo" icon={<Globe2 />} description={campaign.world.name || "Sem nome definido"} />
              <div className="flex flex-col gap-4 p-5 pt-4">
                <p className="text-sm leading-relaxed text-fg-muted">{campaign.world.premise || "O mestre ainda não descreveu a premissa."}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {campaign.world.tone.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                  {campaign.world.startingLocation && (
                    <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
                      <MapPin className="size-3.5" /> {campaign.world.startingLocation}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Sessões" icon={<CalendarDays />} description={`${pastSessions.length} jogadas · ${upcomingSessions.length} agendadas`} />
              <div className="grid gap-6 p-5 pt-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Agendadas</h3>
                  {upcomingSessions.length === 0 ? (
                    <p className="text-sm text-fg-subtle">Nenhuma sessão agendada.</p>
                  ) : (
                    upcomingSessions.map((s) => <SessionRow key={s.id} session={s} system={summary} />)
                  )}
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-fg-subtle">
                    <History className="size-3.5" /> Histórico
                  </h3>
                  {pastSessions.length === 0 ? (
                    <p className="text-sm text-fg-subtle">Ainda não houve sessões.</p>
                  ) : (
                    pastSessions.map((s) => <SessionRow key={s.id} session={s} system={summary} showSummary />)
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title={`Sistema: ${system.name}`} icon={<Sparkles />} description={system.tagline} />
              <dl className="grid gap-x-6 gap-y-3 p-5 pt-4 text-sm sm:grid-cols-2">
                <Fact label="Rolagem padrão" value={<code className="font-mono text-xs text-accent">{system.dice.defaultFormula}</code>} />
                <Fact label="Iniciativa" value={<code className="font-mono text-xs">{system.combat.initiativeFormula}</code>} />
                <Fact label="Atributos" value={system.attributes.map((a) => a.abbreviation).join(" · ")} />
                <Fact label="Recursos" value={system.resources.map((r) => r.label).join(" · ")} />
              </dl>
            </Card>
          </div>

          <aside className="flex flex-col gap-4">
            {next && (
              <Card className="p-5">
                <p className="text-xs text-fg-subtle">Próxima sessão · {formatRelative(next.scheduledAt)}</p>
                <p className="mt-1 font-display text-lg font-semibold">
                  #{next.number} {next.title}
                </p>
                <p className="mt-1 text-sm text-fg-muted">{formatDateTime(next.scheduledAt)}</p>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Mesa"
                icon={<Users />}
                description={`${members.filter((m) => m.role === "player").length}/${campaign.playerPolicy.maxPlayers} jogadores`}
                action={
                  isGM && can(role, "campaign:invite") ? (
                    <ButtonLink href={`/campaign/${campaign.id}/settings?tab=players`} size="icon-sm" variant="ghost" title="Link de convite e jogadores" aria-label="Link de convite e jogadores">
                      <UserPlus className="size-4" />
                    </ButtonLink>
                  ) : undefined
                }
              />
              <ul className="flex flex-col gap-1 p-3 pt-3">
                {members.map(({ profile, role: memberRole, character }) => (
                  <li key={profile.id} className="flex items-center gap-3 rounded-lg p-2">
                    <Avatar name={profile.displayName} color={profile.avatarColor} src={profile.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {profile.displayName}
                        {memberRole === "game_master" && <Crown className="size-3 text-accent" aria-label="Mestre" />}
                      </p>
                      <p className="truncate text-xs text-fg-subtle">
                        {memberRole === "game_master"
                          ? `Narra como “${campaign.gameMaster.narratorName}”`
                          : character
                            ? `${character.name} · ${character.concept}`
                            : "Sem personagem ainda"}
                      </p>
                      {character?.resources[0] && (
                        <ResourceBar
                          className="mt-1.5"
                          value={character.resources[0].current}
                          max={character.resources[0].max}
                          color={character.resources[0].color}
                          showValue={false}
                          label={undefined}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Regras da mesa</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-fg-muted">
                <Rule on={campaign.playerPolicy.playersCanEditSheets}>Jogadores editam as próprias fichas</Rule>
                <Rule on={campaign.playerPolicy.allowPrivateMessages}>Mensagens privadas com o mestre</Rule>
                <Rule on={campaign.playerPolicy.rollsPublicByDefault}>Rolagens públicas por padrão</Rule>
              </ul>
              {narration && <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">Narração: {narration.label}</p>}
            </Card>
          </aside>
        </div>
      </PageContainer>
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-fg-muted">{value}</dd>
    </div>
  );
}

function Rule({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={on ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-fg-subtle/50"} />
      <span className={on ? "" : "text-fg-subtle line-through decoration-fg-subtle/40"}>{children}</span>
    </li>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy>
      <Skeleton className="h-64 rounded-none" />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-40 rounded-[var(--radius-card)]" />
            <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-80 rounded-[var(--radius-card)]" />
        </div>
      </PageContainer>
    </div>
  );
}
