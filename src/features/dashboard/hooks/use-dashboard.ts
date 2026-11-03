"use client";

import { useCallback, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { dashboardService } from "@/services/dashboard.service";
import { campaignService } from "@/services/campaign.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";

export function useDashboard() {
  const user = useCurrentUser();
  const state = useAsync(() => dashboardService.load(user), [user.id, user.email]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const { reload } = state;

  const respondToInvite = useCallback(
    async (inviteId: string, accept: boolean, campaignName: string) => {
      setRespondingTo(inviteId);
      try {
        await campaignService.respondToInvite(inviteId, accept, user);
        if (accept) toast.success("Convite aceito", `Você agora faz parte de ${campaignName}.`);
        else toast.info("Convite recusado", campaignName);
        await reload();
      } catch (error) {
        toast.error("Não foi possível responder ao convite", toUserMessage(error));
      } finally {
        setRespondingTo(null);
      }
    },
    [user, reload],
  );

  return { ...state, user, respondToInvite, respondingTo };
}
