"use client";

import { useMemo, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhaseBadge, Skeleton } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { collectionService } from "@/services/collection.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { CharacterCard } from "./character-card";

type Filter = "all" | "in-campaign" | "free";

export function CharactersView() {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => collectionService.listCharacters(user.id), [user.id]);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () =>
      (data ?? []).filter((m) =>
        filter === "all" ? true : filter === "in-campaign" ? m.character.campaignId !== null : m.character.campaignId === null,
      ),
    [data, filter],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Personagens"
        description="Sua biblioteca de personagens. Cada ficha segue o modelo do sistema e pode ser personalizada."
        actions={
          <div className="flex items-center gap-2">
            <Button disabled leadingIcon={<Plus className="size-4" />} title="Editor de fichas — Fase 2">
              Novo personagem
            </Button>
            <PhaseBadge phase={2} />
          </div>
        }
      />

      <Tabs
        className="mb-6"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "Todos", count: data?.length },
          { value: "in-campaign", label: "Em campanhas", count: data?.filter((m) => m.character.campaignId).length },
          { value: "free", label: "Disponíveis", count: data?.filter((m) => !m.character.campaignId).length },
        ]}
      />

      {status === "error" && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UsersRound />} title="Nenhum personagem aqui" description="A criação de personagens com fichas configuráveis chega na Fase 2." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((model) => (
            <CharacterCard key={model.character.id} model={model} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
