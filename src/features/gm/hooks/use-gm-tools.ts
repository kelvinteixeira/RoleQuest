"use client";

import { useCallback } from "react";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { gmService } from "@/services/gm.service";
import { toast } from "@/stores/toast.store";
import type { Encounter, EncounterInput, Npc, NpcInput } from "@/types/gm";

/** The GM's NPCs and encounters for a campaign, with actions that report through toasts. */
export function useGmTools(campaignId: string) {
  const user = useCurrentUser();
  const npcs = useAsync(() => gmService.listNpcs(campaignId, user), [campaignId, user.id]);
  const encounters = useAsync(() => gmService.listEncounters(campaignId, user), [campaignId, user.id]);

  const run = useCallback(async <T,>(action: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await action();
      if (success) toast.success(success);
      return result;
    } catch (e) {
      toast.error("Não deu certo", toUserMessage(e));
      return null;
    }
  }, []);

  const reloadNpcs = npcs.reload;
  const reloadEncounters = encounters.reload;

  return {
    npcs: npcs.data ?? [],
    encounters: encounters.data ?? [],
    loading: (!npcs.data && npcs.status === "loading") || (!encounters.data && encounters.status === "loading"),
    error: npcs.status === "error" ? npcs.error : encounters.status === "error" ? encounters.error : null,
    reload: useCallback(() => void Promise.all([reloadNpcs(), reloadEncounters()]), [reloadNpcs, reloadEncounters]),

    saveNpc: useCallback(
      async (input: Omit<NpcInput, "campaignId">, id?: string): Promise<Npc | null> => {
        const saved = await run(() => (id ? gmService.updateNpc(campaignId, user, id, input) : gmService.createNpc(campaignId, user, input)), id ? "NPC salvo" : "NPC criado");
        if (saved) await reloadNpcs();
        return saved;
      },
      [campaignId, user, run, reloadNpcs],
    ),
    /** Resolves to whether it was removed. */
    removeNpc: useCallback(
      async (id: string): Promise<boolean> => {
        const ok = (await run(() => gmService.removeNpc(campaignId, user, id).then(() => true), "NPC excluído")) === true;
        if (ok) await Promise.all([reloadNpcs(), reloadEncounters()]);
        return ok;
      },
      [campaignId, user, run, reloadNpcs, reloadEncounters],
    ),
    revealFact: useCallback(
      async (npcId: string, factId: string, revealed: boolean): Promise<Npc | null> => {
        const npc = await run(() => gmService.setFactRevealed(campaignId, user, npcId, factId, revealed));
        if (npc) await reloadNpcs();
        return npc;
      },
      [campaignId, user, run, reloadNpcs],
    ),
    saveEncounter: useCallback(
      async (input: Omit<EncounterInput, "campaignId"> & { id?: string }): Promise<Encounter | null> => {
        const saved = await run(() => gmService.saveEncounter(campaignId, user, input), "Encontro salvo");
        if (saved) await reloadEncounters();
        return saved;
      },
      [campaignId, user, run, reloadEncounters],
    ),
    removeEncounter: useCallback(
      async (id: string): Promise<boolean> => {
        const ok = (await run(() => gmService.removeEncounter(campaignId, user, id).then(() => true), "Encontro excluído")) === true;
        if (ok) await reloadEncounters();
        return ok;
      },
      [campaignId, user, run, reloadEncounters],
    ),
  };
}

export type GmTools = ReturnType<typeof useGmTools>;
