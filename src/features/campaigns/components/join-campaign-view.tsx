"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { campaignService } from "@/services/campaign.service";
import { toast } from "@/stores/toast.store";
import { SystemEmblem } from "@/features/systems/components/system-identity";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";

/** Opened from an invite link: shows the campaign and lets the user join as a player. */
export function JoinCampaignView({ code }: { code: string }) {
  const user = useCurrentUser();
  const router = useRouter();
  const invite = useAsync(() => campaignService.previewInvite(code, user), [code, user.id]);
  const [joining, setJoining] = useState(false);

  if (invite.status === "loading" && !invite.data) return <LoadingState label="Abrindo o convite…" />;
  if (invite.status === "error" || !invite.data) {
    return (
      <PageContainer>
        <ErrorState error={invite.error} />
        <div className="mt-4 flex justify-center">
          <ButtonLink href="/dashboard" variant="secondary">
            Ir para o painel
          </ButtonLink>
        </div>
      </PageContainer>
    );
  }

  const { preview, system } = invite.data;

  async function join() {
    setJoining(true);
    try {
      const campaignId = await campaignService.joinWithInvite(code, user);
      toast.success("Você entrou na campanha", preview.campaignName);
      router.replace(`/campaign/${campaignId}`);
    } catch (e) {
      toast.error("Não deu para entrar", toUserMessage(e));
      setJoining(false);
      await invite.reload();
    }
  }

  return (
    <PageContainer>
      <Card className="mx-auto mt-8 max-w-lg p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Convite para a mesa</p>
        <div className="mt-4 flex items-start gap-4">
          <SystemEmblem theme={system.theme} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{preview.campaignName}</h1>
            {preview.tagline && <p className="mt-1 text-sm text-fg-muted">{preview.tagline}</p>}
            <p className="mt-2 text-xs text-fg-subtle">
              {preview.systemName ?? system.shortName} · Mestre: {preview.gameMasterName}
            </p>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-sm text-fg-muted">
          <Users className="size-4" />
          {preview.alreadyMember ? "Você já faz parte desta campanha." : preview.freeSeats > 0 ? `${preview.freeSeats} vaga(s) livre(s)` : "Sem vagas livres no momento."}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {preview.alreadyMember ? (
            <ButtonLink href={`/campaign/${preview.campaignId}`} leadingIcon={<DoorOpen className="size-4" />}>
              Abrir a campanha
            </ButtonLink>
          ) : (
            <Button onClick={() => void join()} loading={joining} disabled={preview.freeSeats <= 0} leadingIcon={<DoorOpen className="size-4" />}>
              Entrar como jogador
            </Button>
          )}
          <ButtonLink href="/dashboard" variant="ghost">
            Agora não
          </ButtonLink>
        </div>
        {!preview.alreadyMember && preview.freeSeats <= 0 && <p className="mt-3 text-xs text-fg-subtle">Peça ao mestre para abrir mais vagas e tente de novo.</p>}
      </Card>
    </PageContainer>
  );
}
