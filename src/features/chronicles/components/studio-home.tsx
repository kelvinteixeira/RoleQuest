"use client";

import Link from "next/link";
import { Clapperboard, Film } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { campaignService } from "@/services/campaign.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";

/** Chronicles Studio entrance: the campaigns this user runs, each with its studio. */
export function StudioHome() {
  const user = useCurrentUser();
  const cards = useAsync(() => campaignService.listForUser(user.id), [user.id]);
  if (cards.status === "error" && !cards.data) {
    return (
      <PageContainer>
        <ErrorState error={cards.error} onRetry={cards.reload} />
      </PageContainer>
    );
  }
  if (!cards.data) return <LoadingState label="Abrindo o estúdio…" />;
  const mine = cards.data.filter((c) => c.role === "game_master");
  return (
    <PageContainer>
      <PageHeader eyebrow="Chronicles Studio" title="Da mesa para as telas" description="Escolha a campanha: os melhores momentos viram um episódio com roteiro, quadros ilustrados e vídeo." />
      {mine.length === 0 ? (
        <EmptyState icon={<Clapperboard />} title="Nenhuma campanha sua" description="O estúdio é dos mestres: crie uma campanha (ou seja promovido a mestre) para montar episódios." />
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map(({ campaign }) => (
            <li key={campaign.id}>
              <Link href={`/campaign/${campaign.id}/chronicles`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-accent/50">
                  <Film className="size-5 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{campaign.name}</span>
                    <span className="block truncate text-xs text-fg-subtle">{campaign.tagline || "Abrir o estúdio"}</span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
