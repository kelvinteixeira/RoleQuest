"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Swords } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CAMPAIGN_STATUS } from "@/constants/campaign";
import { useAsync } from "@/hooks/use-async";
import { campaignService } from "@/services/campaign.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { CampaignStatus } from "@/types/campaign";
import { CampaignCard, CampaignCardSkeleton } from "./campaign-card";

type RoleFilter = "all" | "game_master" | "player";

export function CampaignsView() {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => campaignService.listForUser(user.id), [user.id]);
  const [role, setRole] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (m) =>
        (role === "all" || m.role === role) &&
        (statusFilter === "all" || m.campaign.status === statusFilter) &&
        (!q || m.campaign.name.toLowerCase().includes(q) || m.system.name.toLowerCase().includes(q)),
    );
  }, [data, role, statusFilter, query]);

  const count = (r: RoleFilter) => (data ?? []).filter((m) => r === "all" || m.role === r).length;

  return (
    <PageContainer>
      <PageHeader
        title="Campanhas"
        description="Todas as mesas em que você conduz ou participa."
        actions={
          <ButtonLink href="/campaigns/new" leadingIcon={<Plus className="size-4" />}>
            Nova campanha
          </ButtonLink>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={role}
          onChange={setRole}
          items={[
            { value: "all", label: "Todas", count: count("all") },
            { value: "game_master", label: "Como mestre", count: count("game_master") },
            { value: "player", label: "Como jogador", count: count("player") },
          ]}
        />
        <div className="flex gap-2">
          <Input
            aria-label="Buscar campanhas"
            placeholder="Buscar por nome ou sistema"
            leadingIcon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            containerClassName="flex-1 lg:w-72"
          />
          <Select aria-label="Filtrar por status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "all")} containerClassName="w-44">
            <option value="all">Todos os status</option>
            {Object.entries(CAMPAIGN_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {status === "error" && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Swords />}
          title={data.length === 0 ? "Você ainda não tem campanhas" : "Nada encontrado com esses filtros"}
          description={data.length === 0 ? "Crie uma campanha e convide seus amigos." : "Tente outro termo ou limpe os filtros."}
          action={
            data.length === 0 ? (
              <ButtonLink href="/campaigns/new" size="sm" leadingIcon={<Plus className="size-3.5" />}>
                Criar campanha
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model) => (
            <CampaignCard key={model.campaign.id} model={model} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
