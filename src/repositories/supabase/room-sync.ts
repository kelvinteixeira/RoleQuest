/**
 * The table in real time over Supabase: rows in Postgres (RLS decides who
 * reads and writes what) and Realtime postgres_changes to hear about them.
 * See supabase/migrations/20261106000000_realtime_table.sql.
 */
import { supabase } from "@/lib/supabase/client";
import type { RoomIntentEnvelope, RoomSyncRepository } from "../contracts";
import { unwrap, unwrapMaybe } from "./errors";

type Row = Record<string, unknown>;

const toIntent = (r: Row): RoomIntentEnvelope => ({ id: r.id as string, userId: r.user_id as string, intent: r.intent, createdAt: r.created_at as string });

export const supabaseRoomSync: RoomSyncRepository = {
  async claimHost(campaignId, clientId, takeover) {
    const rows = unwrap(await supabase().rpc("claim_room_host", { cid: campaignId, client: clientId, takeover })) as Row[] | null;
    const row = rows?.[0];
    return { hosting: row?.hosting === true, holderUserId: (row?.holder_user as string | null) ?? null };
  },
  async releaseHost(campaignId, clientId) {
    await supabase().rpc("release_room_host", { cid: campaignId, client: clientId });
  },

  async loadState(campaignId) {
    const row = unwrapMaybe<Row>(await supabase().from("room_states").select("state").eq("campaign_id", campaignId).maybeSingle());
    return row?.state ?? null;
  },
  async saveState(campaignId, clientId, state) {
    return unwrap(await supabase().rpc("save_room_state", { cid: campaignId, client: clientId, room: state })) === true;
  },

  async publish(campaignId, clientId, views, map) {
    if (views.length === 0 && !map) return true;
    const rows = views.map((v) => ({ user_id: v.userId, view: v.view, revision: v.revision }));
    const result = await supabase().rpc("publish_room", { cid: campaignId, client: clientId, views: rows, map: map?.map ?? null, map_revision: map?.revision ?? null });
    return unwrap(result) === true;
  },
  async loadView(campaignId, userId) {
    const row = unwrapMaybe<Row>(await supabase().from("room_views").select("view").eq("campaign_id", campaignId).eq("user_id", userId).maybeSingle());
    return row?.view ?? null;
  },
  async loadPlayerMap(campaignId) {
    const row = unwrapMaybe<Row>(await supabase().from("room_view_maps").select("map, revision").eq("campaign_id", campaignId).maybeSingle());
    return row ? { map: row.map, revision: Number(row.revision) } : null;
  },

  async sendIntent(campaignId, intent) {
    unwrap(await supabase().from("room_intents").insert({ campaign_id: campaignId, intent }));
  },
  async pendingIntents(campaignId) {
    return ((unwrap(await supabase().rpc("pending_room_intents", { cid: campaignId })) as Row[] | null) ?? []).map(toIntent);
  },
  async clearIntents(ids) {
    if (ids.length) unwrap(await supabase().from("room_intents").delete().in("id", ids));
  },

  async heartbeat(campaignId, userId, hosting) {
    unwrap(await supabase().from("room_presence").upsert({ campaign_id: campaignId, user_id: userId, hosting, seen_at: new Date().toISOString() }, { onConflict: "campaign_id,user_id" }));
  },
  async leave(campaignId, userId) {
    await supabase().from("room_presence").delete().eq("campaign_id", campaignId).eq("user_id", userId);
  },
  async presence(campaignId) {
    const rows = unwrap(await supabase().from("room_presence").select("user_id, hosting, seen_at").eq("campaign_id", campaignId)) as Row[];
    return rows.map((r) => ({ userId: r.user_id as string, hosting: r.hosting === true, seenAt: r.seen_at as string }));
  },

  subscribe(campaignId, userId, handlers) {
    const filter = `campaign_id=eq.${campaignId}`;
    handlers.onStatus?.("connecting");
    const onView = (payload: { new: unknown }) => {
      const row = payload.new as Row | undefined;
      // GMs may read every view (RLS): each client only takes its own.
      if (!row || row.user_id !== userId) return;
      handlers.onView?.(row.view ?? null);
    };
    // Only inserts and updates: Realtime can't filter deletes (they would reach every subscriber).
    const channel = supabase()
      .channel(`room:${campaignId}:${userId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_views", filter }, onView)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_views", filter }, onView)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_view_maps", filter }, () => handlers.onPlayerMap?.())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_view_maps", filter }, () => handlers.onPlayerMap?.())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_intents", filter }, (payload) => handlers.onIntent?.(toIntent(payload.new as Row)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_presence", filter }, () => handlers.onPresence?.())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_presence", filter }, () => handlers.onPresence?.())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") handlers.onStatus?.("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") handlers.onStatus?.("offline");
      });
    return () => {
      void supabase().removeChannel(channel);
    };
  },
};
