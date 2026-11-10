/**
 * Pure room engine: applies RoomEvents to a RoomState and builds the
 * events for common actions (rolls, attacks, initiative). No React, no store.
 */
import { createId } from "@/lib/id";
import { roll, type RollMode, type RollResult, type Rng } from "@/features/dice/dice-engine";
import { adaptNpcStats, resolveAttack, rollDamage, rollInitiativeFor } from "@/features/combat/model/rules";
import type { TokenAttack } from "@/features/combat/model/types";
import { PROP_BY_ID, trapOf, type MapDocument, type PlacedProp } from "@/features/map/model/map-document";
import { DEFAULT_VISION, visibleInLight, type LightSource } from "@/features/map/model/vision";
import { canStand, freeCellNear, gridDistance, type Cell } from "./map";
import type { Author, ChatMessage, CombatState, FogState, LoggedEvent, MessageVisibility, RoomEvent, RoomState, RoomToken } from "./types";

const LOG_LIMIT = 400;
const MESSAGE_LIMIT = 200;

export const SYSTEM_AUTHOR: Author = { id: "system", name: "Mesa", color: "oklch(0.6 0.02 300)" };

export function isDown(token: RoomToken): boolean {
  return token.hp.current <= 0;
}

export function currentTurnToken(state: RoomState): RoomToken | null {
  if (!state.combat.active) return null;
  const entry = state.combat.order[state.combat.turn];
  return entry ? (state.tokens.find((t) => t.id === entry.tokenId) ?? null) : null;
}

/* ---------- Fog of war ---------- */

export const createFog = (): FogState => ({ enabled: false, vision: DEFAULT_VISION, explored: [] });

/** A room with nothing playing. */
export const silentAudio = (): RoomState["audio"] => ({ music: null, ambience: [] });

/** The party's eyes: player characters (people and bots) still standing. */
export const partyViewers = (tokens: RoomToken[]) => tokens.filter((t) => t.kind === "pc" && !isDown(t));

/** Lights carried by tokens still standing (the map's own fires are cached per map in `vision.ts`). */
export function carriedLights(tokens: RoomToken[]): LightSource[] {
  return tokens.filter((t) => (t.light ?? 0) > 0 && !isDown(t)).map((t) => ({ x: t.x, y: t.y, radius: t.light! }));
}

/** Cells the party sees right now (line of sight, vision radius and light). */
export function partyVision(state: Pick<RoomState, "map" | "tokens" | "fog">, extraViewers: Cell[] = []): Set<number> {
  return visibleInLight(state.map, [...partyViewers(state.tokens), ...extraViewers], state.fog.vision, carriedLights(state.tokens));
}

/** Adds what the party sees now (and from `along`, squares just walked through) to what it has explored. */
function explore(state: RoomState, along: Cell[] = []): RoomState {
  if (!state.fog.enabled) return state;
  const explored = new Set(state.fog.explored);
  const before = explored.size;
  const seen = partyVision(state, along);
  for (const i of seen) explored.add(i);
  if (explored.size === before) return state;
  return { ...state, fog: { ...state.fog, explored: [...explored].sort((a, b) => a - b) } };
}

/** Events after which the party may see more. */
const SIGHT_EVENTS = new Set<RoomEvent["type"]>(["token.moved", "token.added", "token.hp", "token.synced", "token.light", "map.replaced", "prop.updated", "fog.configured", "lighting.set"]);

function updateProp(map: MapDocument, propId: string, fn: (p: PlacedProp) => PlacedProp): MapDocument {
  return { ...map, props: map.props.map((p) => (p.id === propId ? fn(p) : p)) };
}

/* ---------- Reducer ---------- */

function updateToken(state: RoomState, id: string, fn: (t: RoomToken) => RoomToken): RoomState {
  return { ...state, tokens: state.tokens.map((t) => (t.id === id ? fn(t) : t)) };
}

/** "Caído" follows the hit points: on at 0, off above it. */
function downedConditions(conditions: string[], current: number): string[] {
  return current === 0 ? [...new Set([...conditions, "Caído"])] : conditions.filter((c) => c !== "Caído");
}

/** New max HP: keeps the wound proportion (system change) or the current value (sheet edit, capped). */
function rescaleHp(hp: RoomToken["hp"], max: number, proportional: boolean): RoomToken["hp"] {
  if (hp.max === max) return hp;
  if (proportional) return { current: hp.current <= 0 ? 0 : Math.max(1, Math.round((hp.current / hp.max) * max)), max };
  return { current: hp.current >= hp.max ? max : Math.min(hp.current, max), max };
}

function nextTurn(state: RoomState): CombatState {
  const { combat } = state;
  const alive = (i: number) => {
    const token = state.tokens.find((t) => t.id === combat.order[i]?.tokenId);
    return token && !isDown(token);
  };
  let turn = combat.turn;
  let round = combat.round;
  for (let i = 0; i < combat.order.length; i++) {
    turn += 1;
    if (turn >= combat.order.length) {
      turn = 0;
      round += 1;
    }
    if (alive(turn)) break;
  }
  return { ...combat, turn, round };
}

export function applyEvent(state: RoomState, event: RoomEvent): RoomState {
  const next = reduce(state, event);
  if (!SIGHT_EVENTS.has(event.type)) return next;
  // A player character sees everything on the way, not just where it stops.
  const mover = event.type === "token.moved" && event.path ? next.tokens.find((t) => t.id === event.tokenId) : undefined;
  const along = mover && mover.kind === "pc" && !isDown(mover) && event.type === "token.moved" ? (event.path ?? []) : [];
  return explore(next, along);
}

/** Explored indices of a map that was resized (content anchored top-left, like `resizeMap`). */
function remapExplored(explored: number[], from: { cols: number; rows: number }, to: { cols: number; rows: number }): number[] {
  const out: number[] = [];
  for (const i of explored) {
    const x = i % from.cols;
    const y = Math.floor(i / from.cols);
    if (x < to.cols && y < to.rows) out.push(y * to.cols + x);
  }
  return out.sort((a, b) => a - b);
}

function reduce(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case "token.added":
      return { ...state, tokens: [...state.tokens, event.token] };
    case "token.removed":
      return {
        ...state,
        tokens: state.tokens.filter((t) => t.id !== event.tokenId),
        combat: { ...state.combat, order: state.combat.order.filter((o) => o.tokenId !== event.tokenId) },
      };
    case "token.moved":
      return updateToken(state, event.tokenId, (t) => ({ ...t, x: event.x, y: event.y }));
    case "token.hp":
      return updateToken(state, event.tokenId, (t) => {
        const current = Math.max(0, Math.min(t.hp.max, t.hp.current + event.delta));
        return { ...t, hp: { ...t.hp, current }, conditions: downedConditions(t.conditions, current) };
      });
    case "token.condition":
      return updateToken(state, event.tokenId, (t) => ({
        ...t,
        conditions: event.on ? [...new Set([...t.conditions, event.condition])] : t.conditions.filter((c) => c !== event.condition),
      }));
    case "token.appearance":
      return updateToken(state, event.tokenId, (t) => ({ ...t, modelId: event.modelId }));
    case "token.stats":
      return updateToken(state, event.tokenId, (t) => ({ ...t, stats: { ...t.stats, ...event.stats } }));
    case "token.synced":
      return updateToken(state, event.tokenId, (t) => {
        const hp = rescaleHp(t.hp, event.hpMax, false);
        const current = event.hpCurrent === undefined ? hp.current : Math.max(0, Math.min(hp.max, event.hpCurrent));
        return { ...t, stats: event.stats, hp: { ...hp, current }, conditions: downedConditions(t.conditions, current) };
      });
    case "token.linked":
      return updateToken(state, event.tokenId, (t) => ({ ...t, characterId: event.characterId }));
    case "rules.set":
      return {
        ...state,
        rules: event.rules,
        tokens: state.tokens.map((t) => {
          if (!t.npc) return t;
          const { stats, hp } = adaptNpcStats(event.rules, t.npc);
          return { ...t, stats: { ...stats, heals: t.stats.heals ?? stats.heals }, hp: rescaleHp(t.hp, hp, true) };
        }),
      };
    case "message.posted":
      return { ...state, messages: [...state.messages, event.message].slice(-MESSAGE_LIMIT) };
    case "combat.started":
      return { ...state, combat: { active: true, round: 1, turn: 0, order: event.order } };
    case "combat.turn":
      return state.combat.active ? { ...state, combat: nextTurn(state) } : state;
    case "combat.joined": {
      if (!state.combat.active) return state;
      const acting = state.combat.order[state.combat.turn]?.tokenId;
      const present = new Set(state.combat.order.map((o) => o.tokenId));
      // Stable sort: on a tie, those already in the order act first.
      const order = [...state.combat.order, ...event.entries.filter((e) => !present.has(e.tokenId))].sort((a, b) => b.initiative - a.initiative);
      const turn = Math.max(0, order.findIndex((o) => o.tokenId === acting));
      return { ...state, combat: { ...state.combat, order, turn } };
    }
    case "combat.ended":
      return { ...state, combat: { active: false, round: 0, turn: 0, order: [] } };
    case "map.replaced": {
      // Tokens left on a now-blocked or off-map square move to the nearest free one.
      const tokens: RoomToken[] = [];
      for (const t of state.tokens) {
        const ok = canStand(event.map, tokens, t, t.id);
        tokens.push(ok ? t : { ...t, ...freeCellNear(event.map, tokens, { x: Math.min(t.x, event.map.cols - 1), y: Math.min(t.y, event.map.rows - 1) }) });
      }
      // Explored areas survive edits (and resizes) of the same map, not a different one.
      const explored = event.map.id !== state.map.id ? [] : event.map.cols === state.map.cols && event.map.rows === state.map.rows ? state.fog.explored : remapExplored(state.fog.explored, state.map, event.map);
      return { ...state, map: event.map, tokens, fog: { ...state.fog, explored } };
    }
    case "map.image":
      return state.map.background ? { ...state, map: { ...state.map, background: { ...state.map.background, imageId: event.imageId } } } : state;
    // Rooms from before the audio centre may lack `audio`: complete it on the way.
    case "audio.music":
      return { ...state, audio: { ...silentAudio(), ...state.audio, music: event.music } };
    case "audio.ambience":
      return { ...state, audio: { ...silentAudio(), ...state.audio, ambience: event.ambience } };
    case "audio.layer": {
      const ambience = (state.audio?.ambience ?? []).filter((l) => l.id !== event.id);
      const at = (state.audio?.ambience ?? []).findIndex((l) => l.id === event.id);
      // A layer keeps its place in the list when only its level changes.
      if (event.volume !== null) ambience.splice(at < 0 ? ambience.length : at, 0, { id: event.id, volume: event.volume });
      return { ...state, audio: { ...silentAudio(), ...state.audio, ambience } };
    }
    case "prop.updated":
      return {
        ...state,
        map: updateProp(state.map, event.propId, (p) => ({
          ...p,
          ...(event.door && { door: { open: false, locked: false, ...p.door, ...event.door } }),
          ...(event.trap && trapOf(p) && { trap: { ...trapOf(p)!, ...event.trap } }),
          ...(event.lit !== undefined && { lit: event.lit }),
        })),
      };
    case "token.light":
      return updateToken(state, event.tokenId, (t) => ({ ...t, light: Math.max(0, Math.min(20, Math.round(event.radius))) || undefined }));
    case "lighting.set":
      return { ...state, map: { ...state.map, ambient: event.ambient } };
    case "fog.configured":
      return {
        ...state,
        fog: {
          ...state.fog,
          enabled: event.enabled ?? state.fog.enabled,
          vision: event.vision === undefined ? state.fog.vision : Math.max(1, Math.min(30, Math.round(event.vision))),
        },
      };
    case "fog.revealed": {
      const explored = new Set(state.fog.explored);
      for (const i of event.cells) if (i >= 0 && i < state.map.cols * state.map.rows) explored.add(i);
      return { ...state, fog: { ...state.fog, explored: [...explored].sort((a, b) => a - b) } };
    }
    case "fog.hidden": {
      const hidden = new Set(event.cells);
      return { ...state, fog: { ...state.fog, explored: state.fog.explored.filter((i) => !hidden.has(i)) } };
    }
  }
}

/** Large payloads stay out of the event log; it only needs to know what happened. */
function forLog(event: RoomEvent): RoomEvent {
  // GM notes never go into the log (it will be broadcast and feed Chronicles Studio).
  if (event.type === "map.replaced") return { ...event, map: { ...event.map, terrain: [], elevation: [], props: [], notes: undefined, spawns: undefined } };
  if (event.type === "fog.revealed" || event.type === "fog.hidden") return { ...event, cells: event.cells.length > 32 ? [] : event.cells };
  return event;
}

export function applyEvents(state: RoomState, events: RoomEvent[], actorId: string): RoomState {
  const at = new Date().toISOString();
  let next = state;
  const logged: LoggedEvent[] = [];
  for (const event of events) {
    next = applyEvent(next, event);
    logged.push({ id: createId("ev"), at, actorId, event: forLog(event) });
  }
  return { ...next, log: [...next.log, ...logged].slice(-LOG_LIMIT) };
}

/* ---------- Message builders ---------- */

function message(partial: Omit<ChatMessage, "id" | "at">): RoomEvent {
  return { type: "message.posted", message: { id: createId("msg"), at: new Date().toISOString(), ...partial } };
}

export const say = (author: Author, text: string): RoomEvent => message({ kind: "chat", author, text, visibility: "public" });

export const whisper = (author: Author, to: { id: string; name: string }, text: string): RoomEvent =>
  message({ kind: "whisper", author, to, text, visibility: "gm" });

export const announce = (text: string): RoomEvent => message({ kind: "system", author: SYSTEM_AUTHOR, text, visibility: "public" });

/** A system line only GMs see (e.g. initiative rolls that name creatures the party hasn't seen). */
export const gmAnnounce = (text: string): RoomEvent => message({ kind: "system", author: SYSTEM_AUTHOR, text, visibility: "gm" });

export const epicMoment = (author: Author, text: string): RoomEvent => message({ kind: "epic", author, text, visibility: "public" });

export function rollEvent(
  author: Author,
  formula: string,
  options: { mode?: RollMode; label?: string; visibility?: MessageVisibility; targetId?: string } = {},
): { event: RoomEvent; result: RollResult } {
  const result = roll(formula, options.mode);
  return {
    result,
    event: message({
      kind: "roll",
      author,
      text: options.label ?? formula,
      roll: { ...result, label: options.label },
      visibility: options.visibility ?? "public",
      targetId: options.targetId,
    }),
  };
}

/** Publishes an already-resolved roll (e.g. a check from a character sheet). */
export function checkEvent(author: Author, result: RollResult, label: string, visibility: MessageVisibility = "public", targetId?: string): RoomEvent {
  return message({ kind: "roll", author, text: label, roll: { ...result, label }, visibility, targetId });
}

export const authorOf = (token: RoomToken): Author => ({ id: token.id, name: token.name, color: token.color });

/* ---------- Combat actions ---------- */

/** Initiative for tokens joining a combat that is already running (reinforcements). */
export function joinCombat(state: Pick<RoomState, "rules">, tokens: RoomToken[], rng?: Rng): RoomEvent[] {
  const entries = tokens.filter((t) => !isDown(t)).map((t) => ({ tokenId: t.id, initiative: rollInitiativeFor(state.rules, t.stats, rng) }));
  if (entries.length === 0) return [];
  const byId = new Map(tokens.map((t) => [t.id, t.name]));
  const summary = entries.map((e) => `${byId.get(e.tokenId)} ${Number.isInteger(e.initiative) ? e.initiative : e.initiative.toFixed(2)}`).join(" · ");
  return [{ type: "combat.joined", entries }, gmAnnounce(`Entram no combate: ${summary}`)];
}

export function rollInitiative(state: RoomState, rng?: Rng): RoomEvent[] {
  const living = state.tokens.filter((t) => !isDown(t));
  const results = living.map((t) => ({ token: t, total: rollInitiativeFor(state.rules, t.stats, rng), tiebreak: Math.random() }));
  const order = results
    .sort((a, b) => b.total - a.total || b.token.stats.initiative - a.token.stats.initiative || a.tiebreak - b.tiebreak)
    .map(({ token, total }) => ({ tokenId: token.id, initiative: total }));
  const summary = results.map(({ token, total }) => `${token.name} ${Number.isInteger(total) ? total : total.toFixed(2)}`).join(" · ");
  return [{ type: "combat.started", order }, announce("Combate! Cada um na sua vez."), gmAnnounce(`Combate! Iniciativa: ${summary}`)];
}

/** Attacks of `attacker` that reach `target` from where it stands. */
export function attacksInReach(attacker: RoomToken, target: { x: number; y: number }): TokenAttack[] {
  const distance = gridDistance(attacker, target);
  return attacker.stats.attacks.filter((a) => a.range >= distance);
}

export interface AttackOutcome {
  events: RoomEvent[];
  hit: boolean;
  critical: boolean;
  damage: number;
  downed: boolean;
}

/**
 * One attack resolved with the room's system rules (see combat/model/rules.ts):
 * the attacker's roll, the defender's roll where the system has one, damage after armor.
 */
export function attack(
  state: Pick<RoomState, "rules">,
  attacker: RoomToken,
  target: RoomToken,
  options: { attackId?: string; mode?: RollMode; rng?: Rng } = {},
): AttackOutcome {
  const chosen = attacker.stats.attacks.find((a) => a.id === options.attackId) ?? attacker.stats.attacks[0];
  if (!chosen) return { events: [announce(`${attacker.name} não tem ataques.`)], hit: false, critical: false, damage: 0, downed: false };

  const resolution = resolveAttack(state.rules, chosen, target.stats, { mode: options.mode, rng: options.rng });
  const events: RoomEvent[] = [];
  for (const r of resolution.rolls) {
    const outcome = r.outcome ? ` — ${r.outcome}` : "";
    if (r.kind === "attack") {
      const weapon = attacker.stats.attacks.length > 1 || chosen.name !== "Ataque" ? ` · ${chosen.name}` : "";
      events.push(checkEvent(authorOf(attacker), r.result, `Ataque em ${target.name}${weapon}${outcome}`, "public", target.id));
    } else if (r.kind === "defense") {
      events.push(checkEvent(authorOf(target), r.result, `Defesa de ${target.name}${outcome}`));
    } else {
      const absorbed = resolution.absorbed > 0 ? ` (armadura absorveu ${resolution.absorbed})` : "";
      events.push(checkEvent(authorOf(attacker), r.result, `${resolution.critical ? "Dano crítico" : "Dano"} em ${target.name}${absorbed}`, "public", target.id));
    }
  }
  const { hit, critical, damage } = resolution;
  const downed = hit && damage > 0 && target.hp.current - damage <= 0;
  if (damage > 0) events.push({ type: "token.hp", tokenId: target.id, delta: -damage });
  if (downed) events.push(announce(target.kind === "enemy" ? `${target.name} está fora de combate.` : `${target.name} caiu!`));
  return { events, hit, critical, damage, downed };
}

/* ---------- Movement and traps ---------- */

export const TRAP_AUTHOR: Author = { id: "trap", name: "Armadilha", color: "oklch(0.6 0.17 45)" };

/** An armed trap on the cell, if any. */
export function armedTrapAt(map: MapDocument, cell: Cell): PlacedProp | undefined {
  return map.props.find((p) => p.x === cell.x && p.y === cell.y && trapOf(p)?.armed);
}

/**
 * Walks `token` along `path`. An armed trap on the way stops it there and
 * goes off: it is revealed and disarmed, and its damage (ignoring armor) is
 * rolled against the token.
 */
export function walk(state: Pick<RoomState, "map">, token: RoomToken, path: Cell[], rng?: Rng): { events: RoomEvent[]; end: Cell; trapped: boolean } {
  const start = { x: token.x, y: token.y };
  const hit = path.findIndex((c) => armedTrapAt(state.map, c));
  const end = hit === -1 ? (path[path.length - 1] ?? start) : path[hit];
  const crossed = path.slice(0, hit === -1 ? path.length : hit + 1);
  const events: RoomEvent[] =
    end.x === start.x && end.y === start.y ? [] : [{ type: "token.moved", tokenId: token.id, x: end.x, y: end.y, ...(crossed.length > 1 && { path: crossed }) }];
  if (hit === -1) return { events, end, trapped: false };

  const trap = armedTrapAt(state.map, end)!;
  const { damage } = trapOf(trap)!;
  const label = PROP_BY_ID.get(trap.propId)?.label ?? "Armadilha";
  events.push({ type: "prop.updated", propId: trap.id, trap: { armed: false, hidden: false } }, announce(`${token.name} ativou: ${label.toLowerCase()}!`));
  // rollDamage falls back to 1 for an invalid formula, so a typo never breaks the table.
  const result = rollDamage(damage, rng);
  const total = Math.max(0, result.total);
  events.push(checkEvent(TRAP_AUTHOR, result, `${label} em ${token.name}`, "public", token.id));
  if (total > 0) events.push({ type: "token.hp", tokenId: token.id, delta: -total });
  if (total > 0 && token.hp.current > 0 && token.hp.current - total <= 0) events.push(announce(`${token.name} caiu!`));
  return { events, end, trapped: true };
}

/** Combat ends when one side has nobody standing. */
export function combatWinner(tokens: RoomToken[]): "party" | "enemies" | null {
  const partyUp = tokens.some((t) => t.kind !== "enemy" && !isDown(t));
  const enemiesUp = tokens.some((t) => t.kind === "enemy" && !isDown(t));
  if (partyUp && !enemiesUp) return "party";
  if (!partyUp && enemiesUp) return "enemies";
  return null;
}
