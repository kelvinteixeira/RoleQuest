"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { can } from "@/lib/permissions";
import { campaignService } from "@/services/campaign.service";
import { toSummary } from "@/services/system.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { CharacterCard } from "@/features/characters/components/character-card";

/**
 * The campaign's characters. The GM opens every sheet; players see the party
 * (name, concept, resources) and open their own.
 */
export function CampaignCharactersView({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);

  if (status === "error" && !data) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={reload} />
      </PageContainer>
    );
  }
  if (!data) return <LoadingState label="Abrindo as fichas…" />;

  const seesAll = can(data.role, "sheet:view-all");
  const system = toSummary(data.system);
  const party = data.members.filter((m) => m.role === "player");

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-4" /> {data.campaign.name}
      </Link>
      <PageHeader eyebrow="Fichas" title="O grupo" description={seesAll ? "Como mestre, você abre e ajusta qualquer ficha da campanha." : "Você abre a sua ficha; dos outros, vê o resumo."} />
      {party.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<ScrollText />} title="Ninguém na mesa ainda" description="Convide jogadores nas configurações da campanha." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {party.map(({ profile, character }) =>
            character ? (
              <div key={profile.id} className="flex flex-col gap-1.5">
                <CharacterCard
                  model={{ character, system, campaignName: data.campaign.name }}
                  href={seesAll || character.ownerId === user.id ? `/characters/${character.id}` : undefined}
                />
                <p className="px-1 text-xs text-fg-subtle">Jogado por {profile.displayName}</p>
              </div>
            ) : (
              <Card key={profile.id} className="flex flex-col justify-center gap-1 p-4">
                <p className="text-sm font-medium">{profile.displayName}</p>
                <p className="text-xs text-fg-subtle">Ainda sem personagem nesta campanha.</p>
              </Card>
            ),
          )}
        </div>
      )}
    </PageContainer>
  );
}
