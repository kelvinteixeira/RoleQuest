/**
 * Pure room engine: applies RoomEvents to a RoomState and builds the
 * events for common actions (rolls, attacks, initiative). No React, no store.
 */
import { createId } from "@/lib/id";
import { critFormula, roll, type RollMode, type RollResult } from "@/features/dice/dice-engine";
import { canStand, freeCellNear } from "./map";
import type { Author, ChatMessage, CombatState, LoggedEvent, MessageVisibility, RoomEvent, RoomState, RoomToken } from "./types";

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

/* ---------- Reducer ---------- */

function updateToken(state: RoomState, id: string, fn: (t: RoomToken) => RoomToken): RoomState {
  return { ...state, tokens: state.tokens.map((t) => (t.id === id ? fn(t) : t)) };
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
        const conditions = current === 0 ? [...new Set([...t.conditions, "Caído"])] : t.conditions.filter((c) => c !== "Caído");
        return { ...t, hp: { ...t.hp, current }, conditions };
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
    case "message.posted":
      return { ...state, messages: [...state.messages, event.message].slice(-MESSAGE_LIMIT) };
    case "combat.started":
      return { ...state, combat: { active: true, round: 1, turn: 0, order: event.order } };
    case "combat.turn":
      return state.combat.active ? { ...state, combat: nextTurn(state) } : state;
    case "combat.ended":
      return { ...state, combat: { active: false, round: 0, turn: 0, order: [] } };
    case "map.replaced": {
      // Tokens left on a now-blocked or off-map square move to the nearest free one.
      const tokens: RoomToken[] = [];
      for (const t of state.tokens) {
        const ok = canStand(event.map, tokens, t, t.id);
        tokens.push(ok ? t : { ...t, ...freeCellNear(event.map, tokens, { x: Math.min(t.x, event.map.cols - 1), y: Math.min(t.y, event.map.rows - 1) }) });
      }
      return { ...state, map: event.map, tokens };
    }
  }
}

export function applyEvents(state: RoomState, events: RoomEvent[], actorId: string): RoomState {
  const at = new Date().toISOString();
  let next = state;
  const logged: LoggedEvent[] = [];
  for (const event of events) {
    next = applyEvent(next, event);
    // Map payloads are large; the log keeps only which map was applied.
    const entry: RoomEvent = event.type === "map.replaced" ? { ...event, map: { ...event.map, terrain: [], elevation: [], props: [] } } : event;
    logged.push({ id: createId("ev"), at, actorId, event: entry });
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

export const authorOf = (token: RoomToken): Author => ({ id: token.id, name: token.name, color: token.color });

/* ---------- Combat actions ---------- */

export function rollInitiative(state: RoomState): RoomEvent[] {
  const living = state.tokens.filter((t) => !isDown(t));
  const results = living.map((t) => ({ token: t, result: roll(`1d20${t.stats.initiativeBonus >= 0 ? "+" : ""}${t.stats.initiativeBonus}`) }));
  const order = results
    .sort((a, b) => b.result.total - a.result.total || b.token.stats.initiativeBonus - a.token.stats.initiativeBonus)
    .map(({ token, result }) => ({ tokenId: token.id, initiative: result.total }));
  const summary = results.map(({ token, result }) => `${token.name} ${result.total}`).join(" · ");
  return [{ type: "combat.started", order }, announce(`Combate! Iniciativa: ${summary}`)];
}

export interface AttackOutcome {
  events: RoomEvent[];
  hit: boolean;
  critical: boolean;
  damage: number;
  downed: boolean;
}

/** d20 + attack bonus vs. defense; natural 20 always hits and doubles damage dice, natural 1 always misses. */
export function attack(attacker: RoomToken, target: RoomToken, mode: RollMode = "normal"): AttackOutcome {
  const bonus = attacker.stats.attackBonus;
  const toHit = rollEvent(authorOf(attacker), `1d20${bonus >= 0 ? "+" : ""}${bonus}`, { mode, label: `Ataque em ${target.name}`, targetId: target.id });
  const natural = toHit.result.natural;
  const critical = natural === 20;
  const hit = critical || (natural !== 1 && toHit.result.total >= target.stats.defense);
  const events: RoomEvent[] = [toHit.event];
  if (!hit) return { events, hit, critical, damage: 0, downed: false };

  const dmg = rollEvent(authorOf(attacker), critical ? critFormula(attacker.stats.damage) : attacker.stats.damage, {
    label: critical ? `Dano crítico em ${target.name}` : `Dano em ${target.name}`,
    targetId: target.id,
  });
  const damage = Math.max(1, dmg.result.total);
  const downed = target.hp.current - damage <= 0;
  events.push(dmg.event, { type: "token.hp", tokenId: target.id, delta: -damage });
  if (downed) events.push(announce(target.kind === "enemy" ? `${target.name} está fora de combate.` : `${target.name} caiu!`));
  return { events, hit, critical, damage, downed };
}

/** Combat ends when one side has nobody standing. */
export function combatWinner(tokens: RoomToken[]): "party" | "enemies" | null {
  const partyUp = tokens.some((t) => t.kind !== "enemy" && !isDown(t));
  const enemiesUp = tokens.some((t) => t.kind === "enemy" && !isDown(t));
  if (partyUp && !enemiesUp) return "party";
  if (!partyUp && enemiesUp) return "enemies";
  return null;
}
