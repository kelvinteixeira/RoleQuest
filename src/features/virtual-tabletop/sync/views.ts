/**
 * What each member of the table receives from the host. Players never get the
 * full room: enemies out of the party's sight, hidden traps, GM notes, secret
 * rolls and other people's whispers stay with the host. GMs (co-GMs, or the
 * same GM in another tab) get everything but the log.
 */
import { trapOf } from "@/features/map/model/map-document";
import type { MapDocument } from "@/features/map/model/map-document";
import { partyVision } from "../model/room-engine";
import type { ChatMessage, LoggedEvent, RoomEvent, RoomState, RoomToken } from "../model/types";

/** Who a view is for. `tokenIds`: the tokens this member plays (their characters). */
export interface Viewer {
  userId: string;
  role: "game_master" | "player";
  tokenIds: string[];
}

/** A message the host sends back to one member (a refused action). */
export interface Notice {
  id: string;
  text: string;
}

/** The view row a member reads. Players' map travels apart (`mapRevision` points to it). */
export interface RoomView {
  /** The hosting client: revisions only compare within one host (a new host starts its own count). */
  host?: string;
  revision: number;
  /** The room without its log (players: without the map, too). */
  room: Omit<RoomState, "map" | "log"> & { map?: MapDocument };
  mapRevision: number;
  /** Latest events this member may see: they drive animations, damage numbers and sounds. */
  recent: LoggedEvent[];
  notices: Notice[];
}

const MESSAGE_LIMIT = 80;
const RECENT_LIMIT = 30;
/** What players see of a creature that isn't theirs: no numbers to read off the payload. */
const HIDDEN_STATS = { defense: 0, armor: 0, speed: 0, initiative: 0, attacks: [] };

/** The map players get: no GM notes, no hidden traps. Terrain stays (sight lines need it); the fog covers it. */
export function playerMapOf(map: MapDocument): MapDocument {
  const { notes: _notes, spawns: _spawns, ...rest } = map;
  void _notes;
  void _spawns;
  return { ...rest, props: map.props.filter((p) => !trapOf(p)?.hidden) };
}

/** Public messages, plus what this member said or was told. */
export function messageVisibleTo(message: ChatMessage, viewer: Viewer): boolean {
  if (viewer.role === "game_master" || message.visibility === "public") return true;
  const mine = (id: string | undefined) => !!id && (id === viewer.userId || viewer.tokenIds.includes(id));
  return mine(message.author.id) || mine(message.to?.id);
}

/** Tokens a player may know about: the party always; others only while the party sees their square. */
export function tokensVisibleTo(state: RoomState, viewer: Viewer): RoomToken[] {
  if (viewer.role === "game_master") return state.tokens;
  const sight = state.fog.enabled ? partyVision(state) : null;
  return state.tokens
    .filter((t) => t.kind === "pc" || !sight || sight.has(t.y * state.map.cols + t.x))
    .map((t) => {
      if (viewer.tokenIds.includes(t.id)) return t;
      // Stat blocks and bot personalities stay with the GM; so do the numbers of creatures.
      const { npc: _npc, botId: _bot, ...shown } = t;
      void _npc;
      void _bot;
      return t.kind === "pc" ? shown : { ...shown, stats: HIDDEN_STATS };
    });
}

/** Keeps the events whose subject this member can see. */
export function eventVisibleTo(event: RoomEvent, room: Pick<RoomState, "tokens" | "messages">, map: MapDocument | undefined, viewer: Viewer): boolean {
  if (viewer.role === "game_master") return true;
  const token = (id: string) => room.tokens.some((t) => t.id === id);
  switch (event.type) {
    case "message.posted":
      return messageVisibleTo(event.message, viewer);
    case "token.moved":
    case "token.hp":
    case "token.condition":
    case "token.light":
    case "token.appearance":
      return token(event.tokenId);
    case "prop.updated":
      return !!map?.props.some((p) => p.id === event.propId);
    // combat.started / combat.joined list every creature in the order: players get the order through the view (masked).
    case "combat.turn":
    case "combat.ended":
    case "lighting.set":
      return true;
    default:
      return false;
  }
}

/** The view one member reads. */
export function viewFor(state: RoomState, viewer: Viewer, meta: { revision: number; mapRevision: number; notices?: Notice[]; host?: string }): RoomView {
  const { log, map, ...rest } = state;
  const isGM = viewer.role === "game_master";
  const tokens = tokensVisibleTo(state, viewer);
  const messages = state.messages.filter((m) => messageVisibleTo(m, viewer)).slice(-MESSAGE_LIMIT);
  const shownMap = isGM ? map : playerMapOf(map);
  const seen = new Set(tokens.map((t) => t.id));
  // The turn order keeps its length (turn indices stay right), but creatures out of sight are anonymous.
  const combat = isGM ? state.combat : { ...state.combat, order: state.combat.order.map((o, i) => (seen.has(o.tokenId) ? o : { tokenId: `oculto-${i}`, initiative: o.initiative })) };
  const room = { ...rest, combat, tokens, messages, ...(isGM && { map }) };
  const sight = !isGM && state.fog.enabled ? partyVision(state) : null;
  const recent = log
    .slice(-RECENT_LIMIT * 2)
    .filter((e) => eventVisibleTo(e.event, { tokens, messages }, shownMap, viewer))
    .slice(-RECENT_LIMIT)
    // A creature walking out of the dark only shows the squares the party sees.
    .map((e) => {
      const ev = e.event;
      if (!sight || ev.type !== "token.moved" || !ev.path || viewer.tokenIds.includes(ev.tokenId)) return e;
      return { ...e, event: { ...ev, path: ev.path.filter((c) => sight.has(c.y * state.map.cols + c.x)) } };
    });
  return { host: meta.host, revision: meta.revision, mapRevision: meta.mapRevision, room, recent, notices: meta.notices ?? [] };
}

/** Rebuilds a renderable room from a view (and the players' shared map). */
export function roomFromView(view: RoomView, playerMap: MapDocument | null): RoomState | null {
  const map = view.room.map ?? playerMap;
  if (!map) return null;
  return { ...view.room, map, log: [] };
}
