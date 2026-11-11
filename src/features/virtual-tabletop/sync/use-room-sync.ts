"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { repositories } from "@/repositories";
import type { RoomIntentEnvelope, RoomPresenceEntry, RoomSyncStatus } from "@/repositories/contracts";
import { createId } from "@/lib/id";
import { toUserMessage } from "@/lib/errors";
import { characterService } from "@/services/character.service";
import type { CampaignOverview } from "@/services/campaign.service";
import { toast } from "@/stores/toast.store";
import type { UserProfile } from "@/types/user";
import type { MapDocument } from "@/features/map/model/map-document";
import { ensureSheet } from "@/features/character-sheet/model/sheet";
import { resolveCheck } from "@/features/character-sheet/model/checks";
import { authorOf, checkEvent } from "../model/room-engine";
import { missingPartyTokens } from "../model/room-factory";
import { upgradeRoom } from "../model/room-migration";
import type { RoomEvent, RoomState } from "../model/types";
import { useRoomStore } from "../store/room.store";
import { parseIntent, resolveIntent, type IntentActor, type RoomIntent, type TurnUsage } from "./intents";
import { playerMapOf, roomFromView, viewFor, type Notice, type RoomView, type Viewer } from "./views";

/** local: no backend (this device only) · host: this GM client runs the table · guest: follows the host. */
export type SyncMode = "local" | "connecting" | "host" | "guest";

export interface PresentMember {
  userId: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  role: "game_master" | "player";
  hosting: boolean;
}

export interface RoomSync {
  mode: SyncMode;
  status: RoomSyncStatus | "local";
  /** A GM is running the table right now. */
  hostOnline: boolean;
  /** The user hosting the table, when it is not this client. */
  holderUserId: string | null;
  /** A guest already has the table from the host. */
  hasView: boolean;
  present: PresentMember[];
  send: (intent: RoomIntent) => void;
  /** GMs: run the table from this client (the other host becomes a guest). */
  takeOver: () => void;
  /**
   * Saves the table now (map, tokens, monsters, fog, combat, chat…) and resolves once it is stored:
   * in the backend when hosting, on this device in local mode. False when it could not be saved.
   */
  saveNow: () => Promise<boolean>;
}

type Member = CampaignOverview["members"][number];
type SheetData = Awaited<ReturnType<typeof characterService.get>>;

const PUBLISH_MS = 120;
const RETRY_MS = 2500;
const SAVE_MS = 1500;
const HEARTBEAT_MS = 10_000;
/** Background tabs run timers about once a minute: someone seen in the last 90 s is still here. */
const ONLINE_MS = 90_000;
const GUEST_POLL_MS = 20_000;
const MEMBERS_REFRESH_MS = 60_000;

/** Tokens a member plays: the ones of their character. */
const tokenIdsOf = (member: Member, room: RoomState) => (member.character ? room.tokens.filter((t) => t.characterId === member.character!.id).map((t) => t.id) : []);

const viewerOf = (member: Member, room: RoomState): Viewer => ({ userId: member.profile.id, role: member.role, tokenIds: tokenIdsOf(member, room) });

function actorOf(member: Member, room: RoomState, overview: CampaignOverview): IntentActor {
  const tokenIds = tokenIdsOf(member, room);
  const own = room.tokens.find((t) => t.id === tokenIds[0]);
  return {
    userId: member.profile.id,
    role: member.role,
    author: { id: member.profile.id, name: own?.name ?? member.profile.displayName, color: own?.color ?? member.profile.avatarColor },
    tokenIds,
    policy: overview.campaign.playerPolicy,
  };
}

const isRoomState = (value: unknown): value is RoomState =>
  !!value && typeof value === "object" && Array.isArray((value as RoomState).tokens) && !!(value as RoomState).map && Array.isArray((value as RoomState).log);

const isView = (value: unknown): value is RoomView => !!value && typeof value === "object" && typeof (value as RoomView).revision === "number" && !!(value as RoomView).room;

/** This tab's id at this table: it survives a reload (the tab keeps hosting), not a new tab. */
function tabClientId(campaignId: string): string {
  const key = `rq:room-client:${campaignId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = createId("cli");
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return createId("cli");
  }
}

/** Online = seen recently, measured against the newest heartbeat (server timestamps; browser clocks differ). */
function onlineRows(rows: RoomPresenceEntry[]): RoomPresenceEntry[] {
  const newest = Math.max(0, ...rows.map((r) => Date.parse(r.seenAt) || 0));
  return rows.filter((r) => newest - (Date.parse(r.seenAt) || 0) < ONLINE_MS);
}

/**
 * The table in real time (Supabase). One GM client hosts: it keeps the full
 * room, applies every change, saves it and publishes each member's view;
 * members follow their view and send intents. Writes are fenced by the host
 * lease, so a host that lost the table can't overwrite the new one. Without a
 * backend (local mode) the room stays on this device, as before.
 */
export function useRoomSync(
  overview: CampaignOverview,
  user: Pick<UserProfile, "id">,
  options: {
    onMembersChanged: () => void;
    /** A player's sheet changed: refresh their token from it (stats, not HP). */
    sheetChanged: (tokenId: string, data: SheetData) => void;
    /** A fresh room, when neither the backend nor this device has one. */
    createRoom: () => RoomState;
  },
): RoomSync {
  const repo = repositories().roomSync;
  const campaignId = overview.campaign.id;
  const isGM = overview.role === "game_master";
  const [mode, setMode] = useState<SyncMode>(repo ? "connecting" : "local");
  const [status, setStatus] = useState<RoomSyncStatus | "local">(repo ? "connecting" : "local");
  const [holderUserId, setHolderUserId] = useState<string | null>(null);
  const [hasView, setHasView] = useState(false);
  const [online, setOnline] = useState<RoomPresenceEntry[]>([]);
  const [epoch, setEpoch] = useState(0);
  const takeoverNext = useRef(false);
  // The running host's immediate save (null when this client does not host).
  const hostSave = useRef<(() => Promise<boolean>) | null>(null);

  // Latest props for long-lived handlers.
  const latest = useRef({ overview, options });
  useEffect(() => {
    latest.current = { overview, options };
  });

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    const stops: (() => void)[] = [];
    const client = tabClientId(campaignId);
    const takeover = takeoverNext.current;
    takeoverNext.current = false;
    const store = useRoomStore.getState;
    const reloaded = new Set<string>();
    /** pagehide: leave the table (not when another tab of this GM is the host). */
    let onPageHide = () => void repo.leave(campaignId, user.id).catch(() => undefined);

    const every = (ms: number, fn: () => void) => {
      const id = setInterval(fn, ms);
      stops.push(() => clearInterval(id));
    };
    const restart = () => alive && setEpoch((e) => e + 1);

    async function refreshPresence() {
      const rows = await repo!.presence(campaignId).catch(() => null);
      if (!alive || !rows) return;
      const here = onlineRows(rows);
      setOnline(here);
      // Someone new at the table (joined by link after the room opened): reload the campaign, once per person.
      const unknown = here.filter((r) => !latest.current.overview.members.some((m) => m.profile.id === r.userId) && !reloaded.has(r.userId));
      if (unknown.length) {
        unknown.forEach((r) => reloaded.add(r.userId));
        latest.current.options.onMembersChanged();
      }
    }

    /* ---------- Host ---------- */

    async function startHost() {
      const saved = await repo!.loadState(campaignId).catch(() => null);
      if (!alive) return;
      // Saved rooms follow the same format upgrades as rooms kept on the device.
      if (isRoomState(saved)) store().replaceRoom(campaignId, upgradeRoom(saved));
      else store().ensureRoom(campaignId, latest.current.options.createRoom);
      // Only now: the room this client runs is the saved one.
      setMode("host");
      setHolderUserId(null);

      let hosting = true;
      let revision = 0;
      let mapRevision = 0;
      let lastMap = "";
      const lastViews = new Map<string, string>();
      const notices = new Map<string, Notice[]>();
      let publishTimer: ReturnType<typeof setTimeout> | null = null;
      let saveTimer: ReturnType<typeof setTimeout> | null = null;
      let writing = Promise.resolve();

      const lost = () => {
        if (!hosting) return;
        hosting = false;
        toast.info("Outro mestre assumiu a mesa", "Você continua vendo tudo e pode assumir de volta.");
        restart();
      };

      const publish = async () => {
        publishTimer = null;
        const room = store().rooms[campaignId];
        if (!room || !alive || !hosting) return;
        const { overview: ov } = latest.current;
        const map = playerMapOf(room.map);
        const mapJson = JSON.stringify(map);
        const mapChanged = mapJson !== lastMap;
        const nextMapRevision = mapChanged ? mapRevision + 1 : mapRevision;
        const rows: { userId: string; view: unknown; revision: number }[] = [];
        const pending = new Map<string, string>();
        let nextRevision = revision;
        for (const member of ov.members) {
          if (member.profile.id === user.id) continue;
          const view = viewFor(room, viewerOf(member, room), { revision: 0, mapRevision: nextMapRevision, notices: notices.get(member.profile.id), host: client });
          const json = JSON.stringify(view);
          if (lastViews.get(member.profile.id) === json) continue;
          pending.set(member.profile.id, json);
          nextRevision += 1;
          rows.push({ userId: member.profile.id, view: { ...view, revision: nextRevision }, revision: nextRevision });
        }
        try {
          const ok = await repo!.publish(campaignId, client, rows, mapChanged ? { map, revision: nextMapRevision } : null);
          if (!ok) return lost();
          // Only what reached the backend counts as sent.
          revision = nextRevision;
          if (mapChanged) {
            lastMap = mapJson;
            mapRevision = nextMapRevision;
          }
          pending.forEach((json, id) => lastViews.set(id, json));
        } catch (e) {
          console.warn("Mesa: falha ao publicar; tentando de novo", e);
          if (alive && hosting) publishTimer = setTimeout(() => void (writing = writing.then(publish)), RETRY_MS);
        }
      };
      const schedulePublish = () => {
        if (publishTimer || !hosting) return;
        publishTimer = setTimeout(() => {
          writing = writing.then(publish).catch((e) => console.warn("Mesa: publicar", e));
        }, PUBLISH_MS);
      };
      const saveRoom = async (): Promise<boolean> => {
        const room = store().rooms[campaignId];
        if (!room || !hosting) return false;
        try {
          const ok = await repo!.saveState(campaignId, client, room);
          if (!ok) lost();
          return ok;
        } catch (e) {
          console.warn("Mesa: falha ao salvar", e);
          return false;
        }
      };
      const save = () => {
        saveTimer = null;
        void saveRoom();
      };
      hostSave.current = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = null;
        return saveRoom();
      };
      stops.push(() => (hostSave.current = null));
      const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(save, SAVE_MS);
      };
      stops.push(() => {
        if (publishTimer) clearTimeout(publishTimer);
        if (saveTimer) {
          clearTimeout(saveTimer);
          save();
        }
      });

      const notify = (userId: string, text: string) => {
        notices.set(userId, [...(notices.get(userId) ?? []).slice(-2), { id: createId("note"), text }]);
        schedulePublish();
      };

      // Players who joined after the room was set up get their token.
      const ensureParty = () => {
        const room = store().rooms[campaignId];
        if (!room || !hosting) return;
        const added = missingPartyTokens(latest.current.overview, room);
        if (added.length) store().dispatch(campaignId, "system", added.map((token): RoomEvent => ({ type: "token.added", token })));
      };

      /* What each token already did this combat turn (one attack, its speed in squares). */
      let turnKey = "";
      const usage = new Map<string, TurnUsage>();
      const usageOf = (room: RoomState, tokenId: string): TurnUsage => {
        const key = room.combat.active ? `${room.combat.round}:${room.combat.turn}` : "";
        if (key !== turnKey) {
          turnKey = key;
          usage.clear();
        }
        return usage.get(tokenId) ?? { moved: 0, attacked: false };
      };

      /* Intents, one at a time in arrival order. */
      const handled = new Set<string>();
      let queue = Promise.resolve();
      const process = async (envelope: RoomIntentEnvelope) => {
        if (!hosting || !alive) return;
        const intent = parseIntent(envelope.intent);
        if (!intent) return;
        const { overview: ov } = latest.current;
        const member = ov.members.find((m) => m.profile.id === envelope.userId);
        if (!member) {
          // Someone who just joined: reload the campaign; they can try again in a moment.
          if (!reloaded.has(envelope.userId)) {
            reloaded.add(envelope.userId);
            latest.current.options.onMembersChanged();
          }
          return;
        }
        const room = store().rooms[campaignId];
        if (!room) return;
        const actor = actorOf(member, room, ov);
        const tokenId = intent.kind === "move" || intent.kind === "check" || intent.kind === "sheet" ? intent.tokenId : intent.kind === "attack" ? intent.attackerId : null;
        const resolution = resolveIntent(room, intent, actor, tokenId ? usageOf(room, tokenId) : undefined);
        if (!resolution.ok) return notify(member.profile.id, resolution.error);
        if (tokenId && resolution.spent) {
          const used = usageOf(room, tokenId);
          usage.set(tokenId, { moved: used.moved + (resolution.spent.moved ?? 0), attacked: used.attacked || !!resolution.spent.attacked });
        }

        if (intent.kind === "check" || intent.kind === "sheet") {
          const token = room.tokens.find((t) => t.id === intent.tokenId)!;
          try {
            const data = await characterService.get(token.characterId!, { id: user.id });
            if (!alive || !hosting) return;
            if (intent.kind === "sheet") {
              if (store().rooms[campaignId]?.combat.active && member.role !== "game_master") return notify(member.profile.id, "Mudanças na ficha entram na mesa depois do combate.");
              return latest.current.options.sheetChanged(token.id, data);
            }
            // The host rolls the check from the sheet it reads itself.
            const check = resolveCheck(data.system, ensureSheet(data.character, data.system), data.character.level, intent.request);
            store().dispatch(campaignId, token.id, [checkEvent(authorOf(token), check.result, check.outcome ? `${check.label} — ${check.outcome}` : check.label)]);
          } catch (e) {
            notify(member.profile.id, toUserMessage(e));
          }
          return;
        }
        if (resolution.events.length) store().dispatch(campaignId, resolution.actorId, resolution.events);
      };
      const enqueue = (envelope: RoomIntentEnvelope) => {
        if (handled.has(envelope.id)) return;
        handled.add(envelope.id);
        queue = queue
          .then(() => process(envelope))
          .catch((e) => console.warn("Mesa: intent", e))
          .then(() => repo!.clearIntents([envelope.id]))
          .catch(() => undefined);
      };
      /** Intents sent while this host wasn't listening (start, reconnects). */
      const catchUp = async () => {
        const pending = await repo!.pendingIntents(campaignId).catch(() => []);
        if (alive && hosting) pending.forEach(enqueue);
      };

      stops.push(
        useRoomStore.subscribe((s, prev) => {
          if (s.rooms[campaignId] !== prev.rooms[campaignId]) {
            schedulePublish();
            scheduleSave();
          }
        }),
      );
      stops.push(
        repo!.subscribe(campaignId, user.id, {
          onIntent: enqueue,
          onPresence: () => void refreshPresence(),
          onStatus: (s) => {
            if (!alive) return;
            setStatus(s);
            if (s === "connected") void catchUp();
          },
        }),
      );

      const beat = () => void repo!.heartbeat(campaignId, user.id, true).catch(() => undefined);
      every(HEARTBEAT_MS, () => {
        beat();
        ensureParty();
        void repo!
          .claimHost(campaignId, client, false)
          .then((claim) => !claim.hosting && lost())
          .catch(() => undefined);
      });
      every(MEMBERS_REFRESH_MS, () => latest.current.options.onMembersChanged());
      every(15_000, () => void refreshPresence());
      stops.push(() => void repo!.releaseHost(campaignId, client).catch(() => undefined));
      onPageHide = () => {
        if (saveTimer) {
          clearTimeout(saveTimer);
          save();
        }
        void repo!.releaseHost(campaignId, client).catch(() => undefined);
        void repo!.leave(campaignId, user.id).catch(() => undefined);
      };

      beat();
      ensureParty();
      if (!saved) scheduleSave();
      schedulePublish();
      void refreshPresence();
      await catchUp();
    }

    /* ---------- Guest ---------- */

    async function startGuest(holder: string | null) {
      setMode("guest");
      setHolderUserId(holder);
      // Another tab of this same GM runs the table: don't take its presence row.
      const shadow = isGM && holder === user.id;
      if (shadow) onPageHide = () => undefined;
      let lastView: RoomView | null = null;
      let playerMap: MapDocument | null = null;
      let mapRevision = -1;
      const shownNotices = new Set<string>();
      let first = true;

      const apply = () => {
        if (!lastView || !alive) return;
        const room = roomFromView(lastView, playerMap);
        if (!room) return;
        store().receiveRoom(campaignId, room, lastView.recent);
        setHasView(true);
      };
      const loadMap = async () => {
        const row = await repo!.loadPlayerMap(campaignId).catch(() => null);
        if (alive && row && row.map && typeof row.map === "object") {
          playerMap = row.map as MapDocument;
          mapRevision = row.revision;
        }
      };
      /** Newer than what we have? A new host restarts the count. */
      const newer = (view: RoomView) => !lastView || view.host !== lastView.host || view.revision > lastView.revision;
      const onView = async (raw: unknown | null) => {
        const view = raw ?? (await repo!.loadView(campaignId, user.id).catch(() => null));
        if (!alive || !isView(view) || !newer(view)) return;
        if (!view.room.map && view.mapRevision !== mapRevision) await loadMap();
        // Another view may have landed while the map loaded.
        if (!alive || !newer(view)) return;
        lastView = view;
        apply();
        for (const n of view.notices) {
          if (shownNotices.has(n.id)) continue;
          shownNotices.add(n.id);
          if (!first) toast.error("Não deu certo", n.text);
        }
        first = false;
      };

      stops.push(
        repo!.subscribe(campaignId, user.id, {
          onView: (v) => void onView(v),
          onPlayerMap: () => void loadMap().then(apply),
          onPresence: () => void refreshPresence(),
          onStatus: (s) => {
            if (!alive) return;
            setStatus(s);
            // Back online: catch up with what changed meanwhile.
            if (s === "connected") void onView(null);
          },
        }),
      );
      const beat = () => {
        if (!shadow) void repo!.heartbeat(campaignId, user.id, false).catch(() => undefined);
        // A GM takes the table over by itself when its host is gone (lease expired).
        if (isGM)
          void repo!
            .claimHost(campaignId, client, false)
            .then((claim) => claim.hosting && restart())
            .catch(() => undefined);
      };
      every(HEARTBEAT_MS, beat);
      // Realtime may drop a message (size limits, sleep): a slow poll keeps the view honest.
      every(GUEST_POLL_MS, () => void onView(null));
      every(15_000, () => void refreshPresence());

      if (!shadow) void repo!.heartbeat(campaignId, user.id, false).catch(() => undefined);
      void refreshPresence();
      if (!isGM) await loadMap();
      if (!alive) return;
      await onView(null);
    }

    async function start() {
      if (isGM) {
        const claim = await repo!.claimHost(campaignId, client, takeover).catch(() => null);
        if (!alive) return;
        if (claim?.hosting) return startHost();
        return startGuest(claim?.holderUserId ?? null);
      }
      return startGuest(null);
    }

    void start().catch((e) => {
      if (alive) toast.error("Não deu para conectar à mesa", toUserMessage(e));
    });

    const pageHide = () => onPageHide();
    window.addEventListener("pagehide", pageHide);
    return () => {
      alive = false;
      window.removeEventListener("pagehide", pageHide);
      for (const stop of stops.splice(0)) stop();
      onPageHide();
    };
  }, [repo, campaignId, isGM, user.id, epoch]);

  const present = useMemo<PresentMember[]>(
    () =>
      online.flatMap((p) => {
        const m = overview.members.find((x) => x.profile.id === p.userId);
        return m ? [{ userId: p.userId, name: m.profile.displayName, color: m.profile.avatarColor, avatarUrl: m.profile.avatarUrl, role: m.role, hosting: p.hosting }] : [];
      }),
    [online, overview.members],
  );

  return {
    mode,
    status,
    hostOnline: mode === "host" || mode === "local" || present.some((p) => p.hosting),
    holderUserId,
    hasView,
    present,
    send: (intent) => {
      if (!repo) return;
      void repo.sendIntent(campaignId, intent).catch((e) => toast.error("Não deu para enviar à mesa", toUserMessage(e)));
    },
    takeOver: () => {
      takeoverNext.current = true;
      setEpoch((e) => e + 1);
    },
    saveNow: async () => {
      // Local mode: the store writes every change to this device as it happens.
      if (mode === "local") return !!useRoomStore.getState().rooms[campaignId];
      return hostSave.current ? hostSave.current() : false;
    },
  };
}
