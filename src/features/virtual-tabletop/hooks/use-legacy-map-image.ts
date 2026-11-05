"use client";

import { useEffect } from "react";
import { appConfig } from "@/config/app";
import type { MapDocument } from "@/features/map/model/map-document";
import { useMapEditorStore } from "@/features/map-editor/store/map-editor.store";
import { mapImageService } from "@/services/map-image.service";
import { toast } from "@/stores/toast.store";
import { useRoomStore } from "../store/room.store";

/**
 * Shared copies by legacy id, for the whole page: one upload per picture,
 * even if the table remounts or the editor brings the old id back.
 */
const uploads = new Map<string, Promise<string | null>>();

function share(campaignId: string, legacyId: string) {
  let upload = uploads.get(legacyId);
  if (!upload) {
    upload = (async () => {
      const blob = await mapImageService.blob(legacyId).catch(() => null);
      if (!blob) return null;
      return mapImageService.save(blob, campaignId);
    })().catch(() => {
      // A failed upload may be tried again on the next visit.
      uploads.delete(legacyId);
      toast.info("A imagem do mapa ficou só neste navegador", "Os jogadores verão o mapa sem o desenho. Tente reabrir a mesa.");
      return null;
    });
    uploads.set(legacyId, upload);
  }
  return upload;
}

const repoint = (doc: MapDocument, from: string, to: string): MapDocument =>
  doc.background?.imageId === from ? { ...doc, background: { ...doc.background, imageId: to } } : doc;

/**
 * Maps imported before pictures were shared live in the GM's browser only.
 * When the client running the table has such a picture, it uploads it to the
 * campaign's storage and points the map (and the open editor copy) at the
 * shared one, so the players see it too.
 */
export function useLegacyMapImage(campaignId: string, imageId: string | undefined, runsTable: boolean) {
  useEffect(() => {
    if (!runsTable || appConfig.dataSource !== "supabase" || !imageId || imageId.includes("/")) return;
    void share(campaignId, imageId).then((shared) => {
      if (!shared) return;
      const room = useRoomStore.getState().rooms[campaignId];
      if (room?.map.background?.imageId === imageId) {
        useRoomStore.getState().dispatch(campaignId, "system", [{ type: "map.image", imageId: shared }]);
      }
      // The editor's working copy (and its undo steps) would bring the old id back on apply.
      useMapEditorStore.setState((s) =>
        [s.draft, ...s.past, ...s.future].some((d) => d?.background?.imageId === imageId)
          ? { draft: s.draft && repoint(s.draft, imageId, shared), past: s.past.map((d) => repoint(d, imageId, shared)), future: s.future.map((d) => repoint(d, imageId, shared)) }
          : s,
      );
    });
  }, [campaignId, imageId, runsTable]);
}
