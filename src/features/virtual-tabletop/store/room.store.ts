import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId } from "@/lib/id";
import { applyEvents } from "../model/room-engine";
import { upgradeRooms } from "../model/room-migration";
import { soundsFor } from "@/features/audio-engine/room-sounds";
import type { SfxName } from "@/features/audio-engine/sfx";
import type { LoggedEvent, RoomEvent, RoomState } from "../model/types";

export type BotSpeed = "slow" | "normal" | "fast";
/** GM brush over the fog of war (null: the map is in play mode). */
export type FogBrush = "reveal" | "hide" | null;
export const BOT_DELAY: Record<BotSpeed, number> = { slow: 2600, normal: 1500, fast: 700 };

/** Short-lived visual feedback over a token (damage numbers, heals). */
export interface TokenFx {
  id: string;
  tokenId: string;
  text: string;
  tone: "damage" | "heal";
}

/** Short-lived animation cue for a token's 3D model (attack, spell, getting hit). */
export interface TokenCue {
  id: string;
  tokenId: string;
  kind: "attack" | "cast" | "hit";
  targetId?: string;
}

/** A token walking a route square by square (moves with a path). */
export interface TokenRoute {
  id: string;
  cells: { x: number; y: number }[];
}

/** Derives animation cues from what just happened at the table. */
function cuesFor(events: RoomEvent[]): TokenCue[] {
  const cues: TokenCue[] = [];
  for (const e of events) {
    if (e.type === "message.posted" && e.message.roll) {
      const label = e.message.roll.label ?? "";
      const kind = label.startsWith("Ataque") ? "attack" : label.startsWith("Cura") ? "cast" : null;
      if (kind) cues.push({ id: createId("cue"), tokenId: e.message.author.id, kind, targetId: e.message.targetId });
    }
    if (e.type === "token.hp" && e.delta < 0) cues.push({ id: createId("cue"), tokenId: e.tokenId, kind: "hit" });
  }
  return cues;
}

/** Damage numbers, model cues, walking routes and sounds for a batch of events (local or received). */
function effectsOf(events: RoomEvent[], before: RoomState | undefined) {
  const fx: TokenFx[] = events
    .filter((e): e is Extract<RoomEvent, { type: "token.hp" }> => e.type === "token.hp" && e.delta !== 0)
    .map((e) => ({ id: createId("fx"), tokenId: e.tokenId, text: e.delta > 0 ? `+${e.delta}` : `${e.delta}`, tone: e.delta > 0 ? "heal" : "damage" }));
  const routes: Record<string, TokenRoute> = {};
  for (const e of events) if (e.type === "token.moved" && e.path && e.path.length > 1) routes[e.tokenId] = { id: createId("route"), cells: e.path };
  return { fx, cues: cuesFor(events), routes, sounds: before ? soundsFor(events, before) : [] };
}

/** Events already shown per room (received views repeat their latest events). */
const seenEvents = new Map<string, Set<string>>();

type RoomStore = {
  /** One room per campaign. Local today; Supabase Realtime in Phase 4. */
  rooms: Record<string, RoomState>;
  /** Rooms received from the table's host (not kept on this device). */
  remote: Record<string, true>;
  /** Routes tokens are walking right now. */
  routes: Record<string, TokenRoute>;
  botsRunning: boolean;
  botSpeed: BotSpeed;
  autoEnemies: boolean;
  selectedTokenId: string | null;
  /** Selected door, gate or trap (exclusive with the token selection). */
  selectedFeatureId: string | null;
  fogBrush: FogBrush;
  fogBrushSize: number;
  /** GM previews the table as the players see it. */
  playerPreview: boolean;
  /** GM notes layer at the table (never shown to players). */
  showNotes: boolean;
  fx: TokenFx[];
  cues: TokenCue[];
  /** Sounds of the latest batch of events (played by `useRoomSounds`). */
  sounds: { id: string; names: SfxName[] } | null;

  ensureRoom: (campaignId: string, create: () => RoomState) => void;
  resetRoom: (campaignId: string, create: () => RoomState) => void;
  dispatch: (campaignId: string, actorId: string, events: RoomEvent[]) => void;
  /** Host: the room saved in the backend replaces this device's copy. */
  replaceRoom: (campaignId: string, room: RoomState) => void;
  /** Guest: a view arrived from the host; its new events play their effects. */
  receiveRoom: (campaignId: string, room: RoomState, recent: LoggedEvent[]) => void;
  select: (tokenId: string | null) => void;
  selectFeature: (propId: string | null) => void;
  setFogBrush: (brush: FogBrush, size?: number) => void;
  setPlayerPreview: (value: boolean) => void;
  setShowNotes: (value: boolean) => void;
  setBotsRunning: (value: boolean) => void;
  setBotSpeed: (value: BotSpeed) => void;
  setAutoEnemies: (value: boolean) => void;
};

export const useRoomStore = create<RoomStore>()(
  persist(
    (set, get) => ({
      rooms: {},
      remote: {},
      routes: {},
      botsRunning: true,
      botSpeed: "normal",
      autoEnemies: true,
      selectedTokenId: null,
      selectedFeatureId: null,
      fogBrush: null,
      fogBrushSize: 3,
      playerPreview: false,
      showNotes: true,
      fx: [],
      cues: [],
      sounds: null,

      ensureRoom: (campaignId, factory) => {
        if (!get().rooms[campaignId]) set({ rooms: { ...get().rooms, [campaignId]: factory() } });
      },
      resetRoom: (campaignId, factory) =>
        set({ rooms: { ...get().rooms, [campaignId]: factory() }, selectedTokenId: null, selectedFeatureId: null, fogBrush: null, playerPreview: false }),

      dispatch: (campaignId, actorId, events) => {
        const room = get().rooms[campaignId];
        if (!room || events.length === 0) return;
        const next = applyEvents(room, events, actorId);
        // The host shows its own events once, not again when they come back in a view.
        const seen = seenEvents.get(campaignId) ?? new Set<string>();
        for (const e of next.log.slice(-events.length)) seen.add(e.id);
        seenEvents.set(campaignId, seen);
        set({ rooms: { ...get().rooms, [campaignId]: next } });
        playEffects(effectsOf(events, room));
      },

      replaceRoom: (campaignId, room) => {
        seenEvents.set(campaignId, new Set(room.log.map((e) => e.id)));
        set({ rooms: { ...get().rooms, [campaignId]: room }, selectedTokenId: null, selectedFeatureId: null });
      },

      receiveRoom: (campaignId, room, recent) => {
        const before = get().rooms[campaignId];
        const known = seenEvents.get(campaignId);
        const seen = known ?? new Set<string>();
        // The first view only sets the table: its recent events already happened.
        const fresh = known ? recent.filter((e) => !seen.has(e.id)) : [];
        for (const e of recent) seen.add(e.id);
        if (seen.size > 400) seenEvents.set(campaignId, new Set(recent.map((e) => e.id)));
        else seenEvents.set(campaignId, seen);
        set({ rooms: { ...get().rooms, [campaignId]: room }, remote: { ...get().remote, [campaignId]: true } });
        if (fresh.length) playEffects(effectsOf(fresh.map((e) => e.event), before));
      },

      select: (tokenId) => set({ selectedTokenId: tokenId, selectedFeatureId: tokenId ? null : get().selectedFeatureId }),
      selectFeature: (propId) => set({ selectedFeatureId: propId, selectedTokenId: propId ? null : get().selectedTokenId }),
      setFogBrush: (brush, size) => set({ fogBrush: brush, fogBrushSize: size ?? get().fogBrushSize }),
      setPlayerPreview: (value) => set({ playerPreview: value }),
      setShowNotes: (value) => set({ showNotes: value }),
      setBotsRunning: (value) => set({ botsRunning: value }),
      setBotSpeed: (value) => set({ botSpeed: value }),
      setAutoEnemies: (value) => set({ autoEnemies: value }),
    }),
    {
      name: "rq:rooms:v2",
      // v1: per-system combat (rules on the room, attacks on tokens). v2: fog of war. v3: table audio.
      version: 3,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<RoomStore> & { rooms?: Parameters<typeof upgradeRooms>[0] };
        return { ...state, rooms: upgradeRooms(state.rooms) } as RoomStore;
      },
      storage: createJSONStorage(() => localStorage),
      // Rooms received from a host are the host's: they are not kept here.
      partialize: ({ rooms, remote, botSpeed, autoEnemies }) => ({
        rooms: Object.fromEntries(Object.entries(rooms).filter(([id]) => !remote[id])),
        botSpeed,
        autoEnemies,
      }),
      skipHydration: true,
    },
  ),
);

/** Selector for one campaign's room. */
export const useRoom = (campaignId: string) => useRoomStore((s) => s.rooms[campaignId] ?? null);

/** Puts effects on screen for a moment (damage numbers, cues), starts routes and sounds. */
function playEffects({ fx, cues, routes, sounds }: ReturnType<typeof effectsOf>) {
  const { getState: get, setState: set } = useRoomStore;
  set({
    fx: [...get().fx, ...fx],
    cues: [...get().cues, ...cues],
    ...(Object.keys(routes).length > 0 && { routes: { ...get().routes, ...routes } }),
    ...(sounds.length > 0 && { sounds: { id: createId("sfx"), names: sounds } }),
  });
  for (const f of fx) setTimeout(() => set({ fx: get().fx.filter((x) => x.id !== f.id) }), 1300);
  for (const c of cues) setTimeout(() => set({ cues: get().cues.filter((x) => x.id !== c.id) }), 1600);
}
