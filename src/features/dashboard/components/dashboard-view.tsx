"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, History, Plus, ScrollText, Swords, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader, Skeleton } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CampaignCard, CampaignCardSkeleton } from "@/features/campaigns/components/campaign-card";
import { CharacterCard } from "@/features/characters/components/character-card";
import { useDashboard } from "../hooks/use-dashboard";
import { JoinByLinkPanel, LibraryShortcuts, NextSessionHero, SessionListCard, StatTile, SystemsStrip } from "./widgets";

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardView() {
  const { status, data, error, reload, user } = useDashboard();
  const [tab, setTab] = useState<"recent" | "active">("recent");
  const now = new Date();
  const firstName = user.displayName.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting(now)}, ${firstName}`}
        description="Suas mesas e próximas sessões em um só lugar."
        actions={
          <ButtonLink href="/campaigns/new" size="lg" leadingIcon={<Plus className="size-4" />}>
            Criar nova campanha
          </ButtonLink>
        }
      />

      {status === "error" && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <motion.div className="flex flex-col gap-10" initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }}>
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Campanhas ativas" value={data.stats.activeCampaigns} icon={<ScrollText />} />
            <StatTile label="Sessões este mês" value={data.stats.sessionsThisMonth} icon={<CalendarDays />} />
            <StatTile label="Personagens" value={data.stats.characters} icon={<UsersRound />} />
            <StatTile label="Horas jogadas" value={data.stats.hoursPlayed} icon={<Clock />} />
          </motion.div>

          <motion.div variants={fadeUp} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-8">
              <NextSessionHero item={data.upcoming[0]} />

              <section>
                <SectionHeader
                  title="Suas campanhas"
                  action={
                    <Tabs
                      size="sm"
                      value={tab}
                      onChange={setTab}
                      items={[
                        { value: "recent", label: "Recentes", count: data.recent.length },
                        { value: "active", label: "Em andamento", count: data.inProgress.length },
                      ]}
                    />
                  }
                />
                {(tab === "recent" ? data.recent : data.inProgress).length === 0 ? (
                  <EmptyState
                    icon={<Swords />}
                    title="Nenhuma campanha por aqui"
                    description="Crie sua primeira campanha ou aceite um convite."
                    action={
                      <ButtonLink href="/campaigns/new" size="sm" leadingIcon={<Plus className="size-3.5" />}>
                        Criar campanha
                      </ButtonLink>
                    }
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {(tab === "recent" ? data.recent : data.inProgress).map((model) => (
                      <CampaignCard key={model.campaign.id} model={model} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="flex flex-col gap-4">
              <JoinByLinkPanel />
              <SessionListCard title="Próximas sessões" icon={<CalendarDays />} items={data.upcoming.slice(1)} empty="Nenhuma outra sessão marcada." />
              <SessionListCard title="Histórico de sessões" icon={<History />} items={data.history} empty="Nenhuma sessão jogada ainda." showSummary />
            </aside>
          </motion.div>

          <motion.section variants={fadeUp}>
            <SectionHeader
              title="Personagens criados"
              description="Sua biblioteca de personagens em todas as mesas."
              action={
                <ButtonLink href="/characters" variant="ghost" size="sm">
                  Ver todos
                </ButtonLink>
              }
            />
            {data.characters.length === 0 ? (
              <EmptyState compact icon={<UsersRound />} title="Nenhum personagem ainda" description="Crie o primeiro na página de personagens." />
            ) : (
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {data.characters.map((model) => (
                  <CharacterCard key={model.character.id} model={model} href={`/characters/${model.character.id}`} className="w-72 shrink-0 snap-start" />
                ))}
              </div>
            )}
          </motion.section>

          <motion.section variants={fadeUp}>
            <SectionHeader
              title="Sistemas disponíveis"
              description="Modelos prontos com fichas, dados e regras configuráveis."
              action={
                <ButtonLink href="/systems" variant="ghost" size="sm">
                  Biblioteca de sistemas
                </ButtonLink>
              }
            />
            <SystemsStrip systems={data.systems} />
          </motion.section>

          <motion.section variants={fadeUp}>
            <SectionHeader title="Bibliotecas" description="Tudo o que você reaproveita entre campanhas." />
            <LibraryShortcuts counts={data.library} />
          </motion.section>
        </motion.div>
      )}
    </PageContainer>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-8">
          <Skeleton className="h-56 rounded-[var(--radius-card)]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampaignCardSkeleton />
            <CampaignCardSkeleton />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          <Skeleton className="h-48 rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
