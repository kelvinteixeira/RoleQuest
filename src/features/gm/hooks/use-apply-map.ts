"use client";

import { useCallback } from "react";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { MapDocument } from "@/features/map/model/map-document";
import type { RoomActions } from "@/features/virtual-tabletop/hooks/use-room-actions";
import { gmService } from "@/services/gm.service";

/**
 * Puts a map on the table. Campaign NPCs placed on it are read fresh from the
 * library first, so their tokens carry the current sheet (the map keeps a
 * snapshot as a fallback when the library cannot be reached).
 */
export function useApplyMap(campaignId: string, actions: Pick<RoomActions, "replaceMap">) {
  const user = useCurrentUser();
  return useCallback(
    async (map: MapDocument) => {
      const needsLibrary = map.spawns?.some((s) => s.npcId);
      const npcs = needsLibrary ? await gmService.listNpcs(campaignId, user).catch(() => []) : [];
      actions.replaceMap(map, npcs);
    },
    [campaignId, user, actions],
  );
}
