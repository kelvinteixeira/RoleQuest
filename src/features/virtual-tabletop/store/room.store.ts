import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId } from "@/lib/id";
import { applyEvents } from "../model/room-engine";
import type { RoomEvent, RoomState } from "../model/types";

export type BotSpeed = "slow" | "normal" | "fast";
export const BOT_DELAY: Record<BotSpeed, number> = { slow: 2600, normal: 1500, fast: 700 };

/** Short-lived visual feedback over a token (damage numbers, heals). */
export interface TokenFx {
  id: string;
  tokenId: string;
  text: string;
  tone: "damage" | "heal";
}

type RoomStore = {
  /** One room per campaign. Local today; Supabase Realtime in Phase 4. */
  rooms: Record<string, RoomState>;
  botsRunning: boolean;
  botSpeed: BotSpeed;
  autoEnemies: boolean;
  selectedTokenId: string | null;
  fx: TokenFx[];

  ensureRoom: (campaignId: string, create: () => RoomState) => void;
  resetRoom: (campaignId: string, create: () => RoomState) => void;
  dispatch: (campaignId: string, actorId: string, events: RoomEvent[]) => void;
  select: (tokenId: string | null) => void;
  setBotsRunning: (value: boolean) => void;
  setBotSpeed: (value: BotSpeed) => void;
  setAutoEnemies: (value: boolean) => void;
};

export const useRoomStore = create<RoomStore>()(
  persist(
    (set, get) => ({
      rooms: {},
      botsRunning: true,
      botSpeed: "normal",
      autoEnemies: true,
      selectedTokenId: null,
      fx: [],

      ensureRoom: (campaignId, factory) => {
        if (!get().rooms[campaignId]) set({ rooms: { ...get().rooms, [campaignId]: factory() } });
      },
      resetRoom: (campaignId, factory) => set({ rooms: { ...get().rooms, [campaignId]: factory() }, selectedTokenId: null }),

      dispatch: (campaignId, actorId, events) => {
        const room = get().rooms[campaignId];
        if (!room || events.length === 0) return;
        const next = applyEvents(room, events, actorId);

        // Damage / heal numbers float over the token for a moment.
        const fx: TokenFx[] = events
          .filter((e): e is Extract<RoomEvent, { type: "token.hp" }> => e.type === "token.hp" && e.delta !== 0)
          .map((e) => ({ id: createId("fx"), tokenId: e.tokenId, text: e.delta > 0 ? `+${e.delta}` : `${e.delta}`, tone: e.delta > 0 ? "heal" : "damage" }));
        set({ rooms: { ...get().rooms, [campaignId]: next }, fx: [...get().fx, ...fx] });
        for (const f of fx) setTimeout(() => set({ fx: get().fx.filter((x) => x.id !== f.id) }), 1300);
      },

      select: (tokenId) => set({ selectedTokenId: tokenId }),
      setBotsRunning: (value) => set({ botsRunning: value }),
      setBotSpeed: (value) => set({ botSpeed: value }),
      setAutoEnemies: (value) => set({ autoEnemies: value }),
    }),
    {
      name: "rq:rooms:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ rooms, botSpeed, autoEnemies }) => ({ rooms, botSpeed, autoEnemies }),
      skipHydration: true,
    },
  ),
);

/** Selector for one campaign's room. */
export const useRoom = (campaignId: string) => useRoomStore((s) => s.rooms[campaignId] ?? null);
