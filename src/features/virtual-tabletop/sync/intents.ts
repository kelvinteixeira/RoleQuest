/**
 * What members ask the host to do at the table. The host resolves each intent
 * against the current room and the member's rights; dice are always rolled by
 * the host, so nobody picks their own results.
 */
import { DiceFormulaError, type RollMode } from "@/features/dice/dice-engine";
import { doorOf } from "@/features/map/model/map-document";
import type { CheckRequest } from "@/features/character-sheet/model/checks";
import type { PlayerPolicy } from "@/types/campaign";
import { routeTo } from "../model/map";
import { createId } from "@/lib/id";
import { attack, attacksInReach, currentTurnToken, isDown, rollEvent, say, walk, whisper } from "../model/room-engine";
import type { Author, RoomEvent, RoomState, RoomToken } from "../model/types";
import { tokensVisibleTo } from "./views";

export type RoomIntent =
  | { kind: "move"; tokenId: string; x: number; y: number }
  | { kind: "chat"; text: string; toGm?: boolean }
  | { kind: "roll"; formula: string; label?: string; mode?: RollMode; secret?: boolean }
  | { kind: "attack"; attackerId: string; targetId: string; attackId?: string }
  | { kind: "door"; propId: string }
  /** "I want to go here": a mark everyone sees; the GM moves the character. */
  | { kind: "ping"; x: number; y: number }
  /** Takes back this member's ping. */
  | { kind: "unping" }
  /** A check from the member's sheet: the host reads the sheet and rolls. */
  | { kind: "check"; tokenId: string; request: CheckRequest }
  /** The member edited their sheet: the host refreshes the token from it. */
  | { kind: "sheet"; tokenId: string }
  /** GMs only: events built on their side (co-GM, or a second tab of the host's GM). */
  | { kind: "events"; events: RoomEvent[]; actorId?: string };

/** Who is asking, as the host knows them (from the campaign, never from the intent). */
export interface IntentActor {
  userId: string;
  role: "game_master" | "player";
  author: Author;
  tokenIds: string[];
  policy: PlayerPolicy;
}

/** What a token already did in the current combat turn (the host keeps it, per turn). */
export interface TurnUsage {
  moved: number;
  attacked: boolean;
}

export type IntentResolution = { ok: true; events: RoomEvent[]; actorId: string; spent?: Partial<TurnUsage> } | { ok: false; error: string };

const MAX_CHAT = 500;
export const GM_RECIPIENT = { id: "gm", name: "Mestre" };

const fail = (error: string): IntentResolution => ({ ok: false, error });

/** The token, if this actor may act with it. */
function ownToken(state: RoomState, actor: IntentActor, tokenId: string): RoomToken | string {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return "Esse personagem não está na mesa.";
  if (actor.role !== "game_master" && !actor.tokenIds.includes(tokenId)) return "Você só age com o seu personagem.";
  return token;
}

/** In combat, a player acts on their own turn. */
function turnBlocked(state: RoomState, actor: IntentActor, token: RoomToken): string | null {
  if (actor.role === "game_master" || !state.combat.active) return null;
  return currentTurnToken(state)?.id === token.id ? null : "Espere a sua vez no combate.";
}

/** Can this player see the token right now? (GMs see everything.) */
function visibleTo(state: RoomState, actor: IntentActor, tokenId: string): boolean {
  if (actor.role === "game_master") return true;
  return tokensVisibleTo(state, { userId: actor.userId, role: actor.role, tokenIds: actor.tokenIds }).some((t) => t.id === tokenId);
}

/**
 * Intents the host resolves on the spot. `check` and `sheet` need the sheet (see the host hook).
 * `usage`: what the acting token already did this combat turn (players get one attack and their speed in squares).
 */
export function resolveIntent(state: RoomState, intent: RoomIntent, actor: IntentActor, usage: TurnUsage = { moved: 0, attacked: false }): IntentResolution {
  const limited = actor.role !== "game_master" && state.combat.active;
  switch (intent.kind) {
    case "events":
      if (actor.role !== "game_master") return fail("Só os mestres fazem isso.");
      return { ok: true, events: intent.events, actorId: typeof intent.actorId === "string" ? intent.actorId : actor.userId };

    case "move": {
      const token = ownToken(state, actor, intent.tokenId);
      if (typeof token === "string") return fail(token);
      if (actor.role !== "game_master") return fail("O mestre move os personagens. Marque no mapa para onde quer ir.");
      if (isDown(token)) return fail(`${token.name} está caído.`);
      const blocked = turnBlocked(state, actor, token);
      if (blocked) return fail(blocked);
      const inside = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;
      if (!inside(intent.x, state.map.cols) || !inside(intent.y, state.map.rows)) return fail("Destino inválido.");
      const path = routeTo(state.map, state.tokens, token, { x: intent.x, y: intent.y });
      if (!path) return fail("Não há caminho até lá.");
      const steps = path.filter((c) => c.x !== token.x || c.y !== token.y).length;
      return { ok: true, events: walk(state, token, path).events, actorId: token.id, spent: { moved: steps } };
    }

    case "chat": {
      const text = intent.text.trim().slice(0, MAX_CHAT);
      if (!text) return fail("Mensagem vazia.");
      if (intent.toGm) {
        if (actor.role !== "game_master" && !actor.policy.allowPrivateMessages) return fail("Mensagens privadas estão desligadas nesta mesa.");
        return { ok: true, events: [whisper(actor.author, GM_RECIPIENT, text)], actorId: actor.userId };
      }
      return { ok: true, events: [say(actor.author, text)], actorId: actor.userId };
    }

    case "roll": {
      try {
        const { event } = rollEvent(actor.author, intent.formula, {
          mode: intent.mode,
          label: intent.label?.slice(0, 80),
          visibility: intent.secret ? "gm" : "public",
        });
        return { ok: true, events: [event], actorId: actor.userId };
      } catch (error) {
        return fail(error instanceof DiceFormulaError ? error.message : "Fórmula de dados inválida.");
      }
    }

    case "attack": {
      const attacker = ownToken(state, actor, intent.attackerId);
      if (typeof attacker === "string") return fail(attacker);
      const target = state.tokens.find((t) => t.id === intent.targetId);
      // Players only target what they see, still standing, and not their own party.
      if (!target || target.id === attacker.id || !visibleTo(state, actor, target.id)) return fail("Alvo inválido.");
      if (actor.role !== "game_master" && (isDown(target) || target.kind === "pc")) return fail("Alvo inválido.");
      if (isDown(attacker)) return fail(`${attacker.name} está caído.`);
      const blocked = turnBlocked(state, actor, attacker);
      if (blocked) return fail(blocked);
      if (limited && usage.attacked) return fail("Você já atacou neste turno.");
      const reach = attacksInReach(attacker, target);
      const chosen = reach.find((a) => a.id === intent.attackId) ?? reach[0];
      if (!chosen) return fail(`${target.name} está fora de alcance.`);
      return { ok: true, events: attack(state, attacker, target, { attackId: chosen.id }).events, actorId: attacker.id, spent: { attacked: true } };
    }

    case "door": {
      // The map is the GM's: players ask (chat or ping) and the GM opens it.
      if (actor.role !== "game_master") return fail("Só o mestre mexe no mapa. Peça a ele para abrir a porta.");
      const prop = state.map.props.find((p) => p.id === intent.propId);
      const door = prop && doorOf(prop);
      if (!prop || !door) return fail("Porta não encontrada.");
      if (!door.open && door.locked) return fail("A porta está trancada.");
      if (door.open && state.tokens.some((t) => t.x === prop.x && t.y === prop.y)) return fail("Há alguém na passagem.");
      return { ok: true, events: [{ type: "prop.updated", propId: prop.id, door: { open: !door.open } }], actorId: actor.userId };
    }

    case "ping": {
      const inside = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;
      if (!inside(intent.x, state.map.cols) || !inside(intent.y, state.map.rows)) return fail("Ponto fora do mapa.");
      const ping = { id: createId("ping"), x: intent.x, y: intent.y, author: actor.author, tokenId: actor.tokenIds[0], at: new Date().toISOString() };
      return { ok: true, events: [{ type: "ping.placed", ping }], actorId: actor.userId };
    }

    case "unping": {
      const mine = state.pings?.find((p) => p.author.id === actor.author.id);
      return { ok: true, events: mine ? [{ type: "ping.cleared", pingId: mine.id }] : [], actorId: actor.userId };
    }

    case "check":
    case "sheet": {
      const token = ownToken(state, actor, intent.tokenId);
      if (typeof token === "string") return fail(token);
      if (!token.characterId) return fail("Esse personagem não tem ficha.");
      return { ok: true, events: [], actorId: token.id };
    }
  }
}

/** Accepts only well-formed intents (they come from the network). */
export function parseIntent(value: unknown): RoomIntent | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const str = (k: string) => typeof v[k] === "string";
  const optional = (k: string, type: "string" | "boolean") => v[k] === undefined || v[k] === null || typeof v[k] === type;
  const int = (k: string) => typeof v[k] === "number" && Number.isSafeInteger(v[k]);
  const modes = [undefined, null, "normal", "advantage", "disadvantage"];
  switch (v.kind) {
    case "move":
      return str("tokenId") && int("x") && int("y") ? (v as RoomIntent) : null;
    case "chat":
      return str("text") && optional("toGm", "boolean") ? (v as RoomIntent) : null;
    case "roll":
      return str("formula") && optional("label", "string") && optional("secret", "boolean") && modes.includes(v.mode as string) ? (v as RoomIntent) : null;
    case "attack":
      return str("attackerId") && str("targetId") && optional("attackId", "string") ? (v as RoomIntent) : null;
    case "door":
      return str("propId") ? (v as RoomIntent) : null;
    case "ping":
      return int("x") && int("y") ? (v as RoomIntent) : null;
    case "unping":
      return v as RoomIntent;
    case "check": {
      const r = v.request as Record<string, unknown> | null;
      const ok =
        str("tokenId") &&
        !!r &&
        typeof r === "object" &&
        ["attributeKey", "skillKey"].every((k) => r[k] === undefined || typeof r[k] === "string") &&
        (r.save === undefined || typeof r.save === "boolean") &&
        modes.includes(r.mode as string);
      return ok ? (v as RoomIntent) : null;
    }
    case "sheet":
      return str("tokenId") ? (v as RoomIntent) : null;
    case "events":
      return Array.isArray(v.events) ? (v as RoomIntent) : null;
    default:
      return null;
  }
}
