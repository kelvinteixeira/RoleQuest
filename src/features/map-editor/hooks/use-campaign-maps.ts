"use client";

import { useCallback } from "react";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { mapService } from "@/services/map.service";
import { toast } from "@/stores/toast.store";
import type { MapDocument } from "@/features/map/model/map-document";
import type { SavedMap } from "@/types/map";

/** The campaign's map library (GM only), with save/remove that report through toasts. */
export function useCampaignMaps(campaignId: string) {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => mapService.list(campaignId, user), [campaignId, user.id]);

  const save = useCallback(
    async (doc: MapDocument, asCopy = false): Promise<SavedMap | null> => {
      try {
        const saved = await mapService.save(campaignId, user, doc, { asCopy });
        toast.success(asCopy ? "Cópia salva na biblioteca" : "Mapa salvo na biblioteca", saved.name);
        await reload();
        return saved;
      } catch (e) {
        toast.error("Não foi possível salvar o mapa", toUserMessage(e));
        return null;
      }
    },
    [campaignId, user, reload],
  );

  const remove = useCallback(
    async (map: SavedMap) => {
      try {
        await mapService.remove(campaignId, user, map.id);
        toast.success("Mapa excluído", map.name);
        await reload();
      } catch (e) {
        toast.error("Não foi possível excluir o mapa", toUserMessage(e));
      }
    },
    [campaignId, user, reload],
  );

  return { maps: data ?? [], loading: status === "loading" && !data, error: status === "error" ? error : null, reload, save, remove };
}
