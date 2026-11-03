/**
 * Pure room engine: applies RoomEvents to a RoomState and builds the
 * events for common actions (rolls, attacks, initiative). No React, no store.
 */
import { createId } from "@/lib/id";
import { roll, type RollMode, type RollResult, type Rng } from "@/features/dice/dice-engine";
import { adaptNpcStats, resolveAttack, rollInitiativeFor } from "@/features/combat/model/rules";
import type { TokenAttack } from "@/features/combat/model/types";
import { canStand, freeCellNear, gridDistance } from "./map";
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
    case "token.synced":
      return updateToken(state, event.tokenId, (t) => ({ ...t, stats: event.stats, hp: rescaleHp(t.hp, event.hpMax, false) }));
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

/** Publishes an already-resolved roll (e.g. a check from a character sheet). */
export function checkEvent(author: Author, result: RollResult, label: string, visibility: MessageVisibility = "public", targetId?: string): RoomEvent {
  return message({ kind: "roll", author, text: label, roll: { ...result, label }, visibility, targetId });
}

export const authorOf = (token: RoomToken): Author => ({ id: token.id, name: token.name, color: token.color });

/* ---------- Combat actions ---------- */

export function rollInitiative(state: RoomState, rng?: Rng): RoomEvent[] {
  const living = state.tokens.filter((t) => !isDown(t));
  const results = living.map((t) => ({ token: t, total: rollInitiativeFor(state.rules, t.stats, rng), tiebreak: Math.random() }));
  const order = results
    .sort((a, b) => b.total - a.total || b.token.stats.initiative - a.token.stats.initiative || a.tiebreak - b.tiebreak)
    .map(({ token, total }) => ({ tokenId: token.id, initiative: total }));
  const summary = results.map(({ token, total }) => `${token.name} ${Number.isInteger(total) ? total : total.toFixed(2)}`).join(" · ");
  return [{ type: "combat.started", order }, announce(`Combate! Iniciativa: ${summary}`)];
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

/** Combat ends when one side has nobody standing. */
export function combatWinner(tokens: RoomToken[]): "party" | "enemies" | null {
  const partyUp = tokens.some((t) => t.kind !== "enemy" && !isDown(t));
  const enemiesUp = tokens.some((t) => t.kind === "enemy" && !isDown(t));
  if (partyUp && !enemiesUp) return "party";
  if (!partyUp && enemiesUp) return "enemies";
  return null;
}
