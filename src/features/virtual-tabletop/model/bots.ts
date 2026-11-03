/**
 * Local test bots. They are clearly labelled as bots in the UI and exist
 * only in this browser: a way to exercise the room before real multiplayer
 * (Phase 4). Decisions are pure functions of the room state.
 */
import { createId } from "@/lib/id";
import type { MapDocument } from "@/features/map/model/map-document";
import { ENEMY_SPAWNS, freeCellNear, gridDistance, pathToAdjacent, PLAYER_SPAWNS } from "./map";
import { adaptNpcStats, healFormula } from "@/features/combat/model/rules";
import type { CombatRules, NpcStatBlock } from "@/features/combat/model/types";
import { attack, authorOf, isDown, rollEvent, say, whisper, announce } from "./room-engine";
import type { RoomEvent, RoomState, RoomToken } from "./types";

interface BotPersona {
  botId: string;
  modelId: string;
  name: string;
  ownerName: string;
  concept: string;
  color: string;
  /** d20-style block, adapted to the room's system. */
  npc: NpcStatBlock;
  lines: { idle: string[]; hit: string[]; miss: string[]; kill: string[]; heal: string[]; whisper: string[] };
}

export const BOT_ROSTER: readonly BotPersona[] = [
  {
    botId: "bot_tamsin",
    modelId: "warrior",
    name: "Tamsin Vale",
    ownerName: "Bot · Ana",
    concept: "Guerreira humana",
    color: "oklch(0.6 0.13 240)",
    npc: { hp: 34, defense: 17, attackBonus: 6, damage: "1d10+4", speed: 6, initiativeBonus: 1, attackName: "Espada longa" },
    lines: {
      idle: ["Alguém mais ouviu passos lá dentro?", "Eu vou na frente. Fiquem atrás do escudo.", "Esse cofre não me cheira bem."],
      hit: ["Toma essa!", "Linha de frente segurando!", "Mais um passo e você conhece meu escudo de perto."],
      miss: ["Ele desviou… da próxima não escapa.", "Escorreguei na areia, sério."],
      kill: ["Um a menos!", "Próximo!"],
      heal: [],
      whisper: ["Entendido, mestre. Fico de olho.", "Não vou contar pra ninguém… ainda."],
    },
  },
  {
    botId: "bot_oru",
    modelId: "barbarian",
    name: "Oru Pedrafunda",
    ownerName: "Bot · Breno",
    concept: "Clérigo anão",
    color: "oklch(0.62 0.12 70)",
    npc: { hp: 30, defense: 16, attackBonus: 5, damage: "1d8+3", speed: 5, initiativeBonus: 0, heals: 3, attackName: "Martelo" },
    lines: {
      idle: ["Pela pedra e pela forja, que essa joia valha a viagem.", "Quem trouxe as tochas extras?", "Lembrem: eu curo, mas não ressuscito por esporte."],
      hit: ["A martelada da fé!", "Isso foi pela minha barba."],
      miss: ["Errei, mas minha fé continua de pé.", "Tsc."],
      kill: ["Descanse em pedra.", "Que a terra te receba."],
      heal: ["Levanta, ainda não acabou!", "Segura essa luz.", "Respira. Você está bem."],
      whisper: ["Hm. Vou rezar sobre isso.", "Guardarei esse segredo, mestre."],
    },
  },
  {
    botId: "bot_kira",
    modelId: "assassin",
    name: "Kira Nox",
    ownerName: "Bot · Clara",
    concept: "Ladina elfa",
    color: "oklch(0.6 0.16 330)",
    npc: { hp: 24, defense: 15, attackBonus: 7, damage: "1d8+4", speed: 7, initiativeBonus: 4, attackName: "Arco curto", range: 6 },
    lines: {
      idle: ["Eu checo as armadilhas. Ninguém encosta em nada.", "Se a joia sumir, não fui eu. Provavelmente.", "Shhh."],
      hit: ["Pelas costas, sempre.", "Nem viu de onde veio."],
      miss: ["Ops.", "Vou fingir que foi de propósito."],
      kill: ["Limpo.", "Nem suou."],
      heal: [],
      whisper: ["Interessante… vou investigar sem chamar atenção.", "Ninguém mais precisa saber disso."],
    },
  },
];

const ENEMY_LINES = {
  hit: ["Ninguém toca na joia!", "Fora daqui!"],
  miss: ["Grr…"],
};

const ENEMIES: { name: string; concept: string; modelId: string; npc: NpcStatBlock }[] = [
  { name: "Esqueleto guerreiro", concept: "Morto-vivo · espada enferrujada", modelId: "skeleton-warrior", npc: { hp: 13, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2, attackName: "Espada enferrujada" } },
  { name: "Esqueleto guerreiro", concept: "Morto-vivo · espada enferrujada", modelId: "skeleton-warrior", npc: { hp: 13, defense: 13, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 2, attackName: "Espada enferrujada" } },
  { name: "Morcego-vampiro", concept: "Criatura · voa e drena sangue", modelId: "vampire-bat", npc: { hp: 11, defense: 12, attackBonus: 5, damage: "1d8+2", speed: 8, initiativeBonus: 3, attackName: "Mordida" } },
  { name: "Guardião da joia", concept: "Chefe · necromante", modelId: "skeleton-mage", npc: { hp: 38, defense: 15, attackBonus: 6, damage: "2d6+3", speed: 4, initiativeBonus: -1, attackName: "Raio necrótico", range: 5 } },
];

const ENEMY_COLOR = "oklch(0.55 0.19 25)";

/** HP, stats and the source block of an NPC token in the room's system. */
function npcFields(rules: CombatRules, npc: NpcStatBlock): Pick<RoomToken, "hp" | "stats" | "npc"> {
  const { stats, hp } = adaptNpcStats(rules, npc);
  return { hp: { current: hp, max: hp }, stats, npc: { ...npc } };
}

export function createEncounterTokens(map: MapDocument, rules: CombatRules, existing: RoomToken[] = []): RoomToken[] {
  const counts = new Map<string, number>();
  const placed: RoomToken[] = [...existing];
  return ENEMIES.map((e, i) => {
    const cell = freeCellNear(map, placed, ENEMY_SPAWNS[i % ENEMY_SPAWNS.length]);
    const n = (counts.get(e.name) ?? 0) + 1;
    counts.set(e.name, n);
    const total = ENEMIES.filter((x) => x.name === e.name).length;
    const token: RoomToken = {
      id: createId("tok"),
      kind: "enemy",
      controller: "gm",
      name: total > 1 ? `${e.name} ${n}` : e.name,
      ownerName: "Mestre",
      concept: e.concept,
      modelId: e.modelId,
      color: ENEMY_COLOR,
      x: cell.x,
      y: cell.y,
      ...npcFields(rules, e.npc),
      conditions: [],
    };
    placed.push(token);
    return token;
  });
}

/** Adds every bot that is not in the room yet, near the entrance. */
export function botJoinEvents(state: RoomState): RoomEvent[] {
  const present = new Set(state.tokens.map((t) => t.botId).filter(Boolean));
  const events: RoomEvent[] = [];
  let tokens = state.tokens;
  for (const persona of BOT_ROSTER) {
    if (present.has(persona.botId)) continue;
    const spawn = PLAYER_SPAWNS.find((c) => !tokens.some((t) => t.x === c.x && t.y === c.y)) ?? { x: 3, y: 8 };
    const cell = freeCellNear(state.map, tokens, spawn);
    const token: RoomToken = {
      id: createId("tok"),
      kind: "pc",
      controller: "bot",
      botId: persona.botId,
      modelId: persona.modelId,
      name: persona.name,
      ownerName: persona.ownerName,
      concept: persona.concept,
      color: persona.color,
      x: cell.x,
      y: cell.y,
      ...npcFields(state.rules, persona.npc),
      conditions: [],
    };
    tokens = [...tokens, token];
    events.push({ type: "token.added", token }, announce(`${persona.name} (${persona.ownerName}) entrou na sala.`));
  }
  return events;
}

const pick = <T,>(items: readonly T[]): T | undefined => items[Math.floor(Math.random() * items.length)];
const persona = (token: RoomToken) => BOT_ROSTER.find((p) => p.botId === token.botId);

/** A step is applied after `delay` ms so movement and rolls read as a sequence. */
export interface BotStep {
  delay: number;
  events: RoomEvent[];
}

const opponentsOf = (state: RoomState, token: RoomToken) =>
  state.tokens.filter((t) => !isDown(t) && (token.kind === "enemy" ? t.kind !== "enemy" : t.kind === "enemy"));

/** Full turn for a bot or an automated enemy. */
export function decideTurn(state: RoomState, actor: RoomToken): BotStep[] {
  const steps: BotStep[] = [];
  const p = persona(actor);
  const lines = p?.lines ?? { ...ENEMY_LINES, idle: [], kill: [], heal: [], whisper: [] };
  const chatter = (pool: string[], chance: number) => {
    const line = Math.random() < chance ? pick(pool) : undefined;
    return line ? [say(authorOf(actor), line)] : [];
  };

  // Support: heal a downed or badly hurt ally within 6 squares.
  if ((actor.stats.heals ?? 0) > 0) {
    const ally = state.tokens
      .filter((t) => t.kind !== "enemy" && t.id !== actor.id && gridDistance(t, actor) <= 6 && t.hp.current / t.hp.max < 0.4)
      .sort((a, b) => a.hp.current - b.hp.current)[0];
    if (ally) {
      const heal = rollEvent(authorOf(actor), healFormula(state.rules), { label: `Cura em ${ally.name}`, targetId: ally.id });
      return [
        { delay: 500, events: [heal.event, { type: "token.hp", tokenId: ally.id, delta: Math.max(1, heal.result.total) }, { type: "token.stats", tokenId: actor.id, stats: { heals: (actor.stats.heals ?? 1) - 1 } }] },
        { delay: 500, events: chatter(lines.heal, 0.8) },
      ];
    }
  }

  // Longest reach first: archers and casters shoot from where they are.
  const weapon = [...actor.stats.attacks].sort((a, b) => b.range - a.range)[0];
  if (!weapon) return [{ delay: 400, events: chatter(lines.idle, 0.3) }];
  const targets = opponentsOf(state, actor).sort((a, b) => gridDistance(a, actor) - gridDistance(b, actor));
  for (const target of targets) {
    let end = { x: actor.x, y: actor.y };
    if (gridDistance(end, target) > weapon.range) {
      const path = pathToAdjacent(state.map, state.tokens, actor, target);
      if (path === null) continue;
      // Walk only until the target is in reach (or the speed runs out).
      const walk = path.slice(0, actor.stats.speed);
      const inReach = walk.findIndex((cell) => gridDistance(cell, target) <= weapon.range);
      const move = inReach === -1 ? walk : walk.slice(0, inReach + 1);
      end = move[move.length - 1] ?? end;
      if (move.length > 0) steps.push({ delay: 400, events: [{ type: "token.moved", tokenId: actor.id, x: end.x, y: end.y }] });
    }
    if (gridDistance(end, target) <= weapon.range) {
      const outcome = attack(state, { ...actor, ...end }, target, { attackId: weapon.id });
      steps.push({ delay: 700, events: outcome.events });
      const reaction = outcome.downed ? lines.kill : outcome.hit ? lines.hit : lines.miss;
      steps.push({ delay: 500, events: chatter(reaction, outcome.downed ? 0.9 : 0.4) });
    }
    return steps;
  }
  // Nobody reachable: hold position.
  return [{ delay: 400, events: chatter(lines.idle, 0.3) }];
}

/** Occasional table talk outside combat. */
export function idleChatter(state: RoomState): RoomEvent[] {
  const bots = state.tokens.filter((t) => t.controller === "bot" && !isDown(t));
  const bot = pick(bots);
  const line = bot ? pick(persona(bot)?.lines.idle ?? []) : undefined;
  return bot && line ? [say(authorOf(bot), line)] : [];
}

/** Private reply from a bot to the GM. */
export function whisperReply(state: RoomState, botTokenId: string, gm: { id: string; name: string }): RoomEvent[] {
  const bot = state.tokens.find((t) => t.id === botTokenId);
  const line = bot ? pick(persona(bot)?.lines.whisper ?? []) : undefined;
  return bot && line ? [whisper(authorOf(bot), gm, line)] : [];
}
