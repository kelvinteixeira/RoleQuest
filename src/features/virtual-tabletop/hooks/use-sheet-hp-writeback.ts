"use client";

import { useEffect } from "react";
import { toUserMessage } from "@/lib/errors";
import { characterService } from "@/services/character.service";
import { toast } from "@/stores/toast.store";
import type { RoomState } from "../model/types";
import { useRoomStore } from "../store/room.store";

const WRITE_DELAY_MS = 500;

/**
 * Keeps character sheets in step with the table: when a player token's HP
 * changes in the room (damage, healing, the GM's buttons, bots), the new
 * value is saved to the linked sheet a moment later. Pending writes are
 * flushed when the room closes.
 */
export function useSheetHpWriteback(campaignId: string, userId: string) {
  useEffect(() => {
    const seen = new Map<string, number>();
    const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; characterId: string }>();

    async function write(tokenId: string, characterId: string) {
      pending.delete(tokenId);
      const token = useRoomStore.getState().rooms[campaignId]?.tokens.find((t) => t.id === tokenId);
      if (!token) return;
      try {
        const { character, system, canEdit } = await characterService.get(characterId, { id: userId });
        const key = system.resources[0]?.key;
        const resource = key ? character.sheet.resources[key] : undefined;
        if (!canEdit || !key || !resource) return;
        const current = Math.min(token.hp.current, resource.max);
        if (resource.current === current) return;
        await characterService.save(characterId, { sheet: { ...character.sheet, resources: { ...character.sheet.resources, [key]: { ...resource, current } } } }, { id: userId });
      } catch (error) {
        toast.error(`Não foi possível salvar os PV de ${token.name} na ficha`, toUserMessage(error));
      }
    }

    function watch(room: RoomState | undefined) {
      for (const t of room?.tokens ?? []) {
        if (!t.characterId) continue;
        const before = seen.get(t.id);
        seen.set(t.id, t.hp.current);
        if (before === undefined || before === t.hp.current) continue;
        clearTimeout(pending.get(t.id)?.timer);
        const characterId = t.characterId;
        pending.set(t.id, { characterId, timer: setTimeout(() => void write(t.id, characterId), WRITE_DELAY_MS) });
      }
    }

    watch(useRoomStore.getState().rooms[campaignId]);
    const unsubscribe = useRoomStore.subscribe((s) => watch(s.rooms[campaignId]));
    return () => {
      unsubscribe();
      for (const [tokenId, { timer, characterId }] of pending) {
        clearTimeout(timer);
        void write(tokenId, characterId);
      }
    };
  }, [campaignId, userId]);
}
