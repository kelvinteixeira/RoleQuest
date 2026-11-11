"use client";

import { useMemo } from "react";
import { DiceFormulaError, type RollMode } from "@/features/dice/dice-engine";
import { toast } from "@/stores/toast.store";
import { botJoinEvents } from "../model/bots";
import { routeTo, type Cell } from "../model/map";
import type { CheckResult } from "@/features/character-sheet/model/checks";
import { combatProfile, sheetHitPoints } from "@/features/combat/model/profile";
import type { CombatRules } from "@/features/combat/model/types";
import { characterService, type EditableCharacter } from "@/services/character.service";
import {
  announce,
  authorOf,
  checkEvent,
  attack,
  combatWinner,
  epicMoment,
  rollEvent,
  joinCombat,
  rollInitiative,
  say,
  walk,
  whisper,
} from "../model/room-engine";
import { doorOf, PROP_BY_ID, type Ambient, type MapDocument, type TrapState } from "@/features/map/model/map-document";
import type { AmbienceLayer, Author, MessageVisibility, MusicCue, RoomEvent, RoomToken } from "../model/types";
import { createId } from "@/lib/id";
import { spawnTokens } from "@/features/gm/model/map-spawns";
import type { Npc } from "@/types/gm";
import { useRoomStore } from "../store/room.store";

const SHEET_SYNC_MS = 400;
const sheetTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSheetHp = new Map<string, number | undefined>();
const hpEdited = new Set<string>();
const normalizeName = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

/**
 * GM actions for one room. Each one becomes RoomEvents through the store, or,
 * for a GM following a table hosted elsewhere, through `forward` (to the host).
 */
export function useRoomActions(campaignId: string, gm: Author, forward?: (events: RoomEvent[], actorId: string) => void) {
  const dispatch = useRoomStore((s) => s.dispatch);

  return useMemo(() => {
    const room = () => useRoomStore.getState().rooms[campaignId];
    const send = (events: RoomEvent[], actorId = gm.id) => (forward ? forward(events, actorId) : dispatch(campaignId, actorId, events));

    function rollDice(formula: string, options: { mode?: RollMode; visibility?: MessageVisibility; label?: string } = {}) {
      try {
        send([rollEvent(gm, formula, options).event]);
        return true;
      } catch (error) {
        toast.error("Fórmula de dados inválida", error instanceof DiceFormulaError ? error.message : formula);
        return false;
      }
    }

    /** Chat with commands: /r 1d20+3, /gm 2d6 (secret), /w Nome mensagem. */
    function sendChat(text: string, whisperTo?: Pick<RoomToken, "id" | "name">) {
      const trimmed = text.trim();
      if (!trimmed) return;
      const [command, ...rest] = trimmed.split(/\s+/);
      if (command === "/r" || command === "/roll") return void rollDice(rest.join(""));
      if (command === "/gm") return void rollDice(rest.join(""), { visibility: "gm", label: "Rolagem secreta" });
      if (command === "/w") {
        const [name, ...words] = rest;
        const target = room()?.tokens.find((t) => t.kind !== "enemy" && t.name.toLowerCase().startsWith((name ?? "").toLowerCase()));
        if (!target || !name) return void toast.error("Destinatário não encontrado", "Use /w Nome mensagem.");
        return void send([whisper(gm, { id: target.id, name: target.name }, words.join(" "))]);
      }
      if (whisperTo) return void send([whisper(gm, { id: whisperTo.id, name: whisperTo.name }, trimmed)]);
      send([say(gm, trimmed)]);
    }

    /**
     * Moves along the way the token would walk, so traps on the route go off
     * and closed doors stop it. `teleport` (Alt-drag, GM only) places it directly.
     */
    function moveToken(token: RoomToken, cell: Cell, options: { teleport?: boolean } = {}) {
      const state = room();
      if (!state) return;
      if (options.teleport) return void send([{ type: "token.moved", tokenId: token.id, x: cell.x, y: cell.y }]);
      const path = routeTo(state.map, state.tokens, token, cell);
      if (!path) return void toast.info("Sem caminho até lá", "Uma porta fechada, parede ou cerca está no caminho. Segure Alt ao soltar para teleportar.");
      send(walk(state, token, path).events);
    }

    /** Anyone on the square, standing or fallen, keeps a door from shutting. */
    const blockedBySomeone = (cell: Cell) => !!room()?.tokens.some((t) => t.x === cell.x && t.y === cell.y);

    const propById = (propId: string) => room()?.map.props.find((p) => p.id === propId);

    function toggleDoor(propId: string) {
      const prop = propById(propId);
      const door = prop && doorOf(prop);
      if (!prop || !door) return;
      if (!door.open && door.locked) return void toast.info("A porta está trancada", "Destranque antes de abrir.");
      if (door.open && blockedBySomeone(prop)) return void toast.info("Há alguém na passagem", "Mova o token antes de fechar.");
      send([{ type: "prop.updated", propId, door: { open: !door.open } }]);
    }

    function setDoorLocked(propId: string, locked: boolean) {
      const prop = propById(propId);
      if (!prop || !doorOf(prop)) return;
      // Locking a door shuts it too (unless someone stands in the way).
      const shut = locked && !blockedBySomeone(prop);
      send([{ type: "prop.updated", propId, door: shut ? { locked, open: false } : { locked } }]);
    }

    function updateTrap(propId: string, trap: Partial<TrapState>) {
      const prop = propById(propId);
      if (!prop) return;
      const events: RoomEvent[] = [{ type: "prop.updated", propId, trap }];
      if (trap.hidden === false) events.push(announce(`O mestre revelou: ${(PROP_BY_ID.get(prop.propId)?.label ?? "armadilha").toLowerCase()}.`));
      send(events);
    }

    function setAmbient(ambient: Ambient) {
      send([{ type: "lighting.set", ambient }, announce(ambient === "dark" ? "A escuridão toma conta do lugar." : ambient === "dim" ? "A luz diminui." : "A luz do dia volta.")]);
    }

    function setTokenLight(token: RoomToken, radius: number) {
      send([{ type: "token.light", tokenId: token.id, radius }]);
    }

    function toggleLight(propId: string) {
      const prop = propById(propId);
      if (prop) send([{ type: "prop.updated", propId, lit: prop.lit === false }]);
    }

    /**
     * Puts tokens on the table (NPCs, an encounter). `rollInitiative` starts a
     * combat, or adds them to the one running (reinforcements get a turn).
     */
    function addTokens(tokens: RoomToken[], options: { announceText?: string; rollInitiative?: boolean } = {}) {
      if (tokens.length === 0) return;
      const events: RoomEvent[] = tokens.map((token) => ({ type: "token.added", token }));
      if (options.announceText) events.push(announce(options.announceText));
      const state = room();
      if (options.rollInitiative && state?.combat.active) events.push(...joinCombat(state, tokens));
      send(events);
      if (options.rollInitiative && !state?.combat.active) startCombat();
    }

    /** A public system line at the table (e.g. a revealed NPC fact); returns its message id. */
    function post(text: string): string {
      const event = announce(text);
      send([event]);
      return event.type === "message.posted" ? event.message.id : "";
    }

    function configureFog(patch: { enabled?: boolean; vision?: number }) {
      send([{ type: "fog.configured", ...patch }]);
    }

    function revealCells(cells: number[]) {
      if (cells.length) send([{ type: "fog.revealed", cells }]);
    }

    function hideCells(cells: number[]) {
      if (cells.length) send([{ type: "fog.hidden", cells }]);
    }

    const allCells = () => {
      const map = room()?.map;
      return map ? Array.from({ length: map.cols * map.rows }, (_, i) => i) : [];
    };

    function adjustHp(token: RoomToken, delta: number) {
      if (!delta) return;
      const events: RoomEvent[] = [{ type: "token.hp", tokenId: token.id, delta }];
      if (token.hp.current > 0 && token.hp.current + delta <= 0) events.push(announce(`${token.name} caiu!`));
      send(events);
    }

    function toggleCondition(token: RoomToken, condition: string) {
      send([{ type: "token.condition", tokenId: token.id, condition, on: !token.conditions.includes(condition) }]);
    }

    function attackWith(attacker: RoomToken, target: RoomToken, attackId?: string) {
      const state = room();
      if (state) send(attack(state, attacker, target, { attackId }).events, attacker.id);
    }

    function setRules(rules: CombatRules) {
      send([{ type: "rules.set", rules }], "system");
    }

    /**
     * Refreshes a player token from its sheet (attacks, defense, max HP) when something changed.
     * `withHp` also takes the sheet's current HP: on room open, or when it was edited on the sheet.
     */
    function applySheet(tokenId: string, { character, system }: Pick<EditableCharacter, "character" | "system">, withHp = false) {
      const token = room()?.tokens.find((t) => t.id === tokenId);
      if (!token) return;
      const stats = { ...combatProfile(system, character.sheet, character.level), heals: token.stats.heals };
      const hp = sheetHitPoints(system, character.sheet);
      const hpMax = hp?.max ?? token.hp.max;
      const hpCurrent = withHp && hp ? Math.min(hp.current, hpMax) : undefined;
      const unchanged = hpMax === token.hp.max && (hpCurrent === undefined || hpCurrent === token.hp.current) && JSON.stringify(stats) === JSON.stringify(token.stats);
      if (unchanged) return;
      send([{ type: "token.synced", tokenId, stats, hpMax, hpCurrent }], "system");
    }

    /** A player's sheet changed (at a hosted table): stats follow, HP stays the table's. */
    function refreshFromSheet(tokenId: string, data: Pick<EditableCharacter, "character" | "system">) {
      applySheet(tokenId, data, false);
    }

    /** Sheet edits arrive per keystroke; the token follows a moment later. */
    function applySheetSoon(tokenId: string, data: Pick<EditableCharacter, "character" | "system">) {
      // Only an HP change made on the sheet moves the token's HP (a stale copy must not undo damage).
      const hp = sheetHitPoints(data.system, data.character.sheet)?.current;
      const previous = lastSheetHp.get(tokenId);
      lastSheetHp.set(tokenId, hp);
      if (previous !== undefined && hp !== previous) hpEdited.add(tokenId);
      clearTimeout(sheetTimers.get(tokenId));
      sheetTimers.set(
        tokenId,
        setTimeout(() => {
          applySheet(tokenId, data, hpEdited.delete(tokenId));
        }, SHEET_SYNC_MS),
      );
    }

    /** The sheet editor was closed: the next one starts from a fresh snapshot. */
    function forgetSheet(tokenId: string) {
      lastSheetHp.delete(tokenId);
    }

    /**
     * Pulls every player token's sheet, which may have changed outside the room
     * (HP included). Tokens from rooms created before sheets were linked are
     * matched to the campaign's characters by name first.
     */
    async function syncSheets(characters: { id: string; name: string }[] = []) {
      const tokens = room()?.tokens ?? [];
      const linked = new Set(tokens.map((t) => t.characterId).filter(Boolean));
      const byName = new Map(characters.map((c) => [normalizeName(c.name), c.id]));
      const links: RoomEvent[] = [];
      for (const t of tokens) {
        if (t.characterId || t.kind !== "pc" || t.controller === "bot") continue;
        const characterId = byName.get(normalizeName(t.name));
        if (!characterId || linked.has(characterId)) continue;
        linked.add(characterId);
        links.push({ type: "token.linked", tokenId: t.id, characterId });
      }
      if (links.length) send(links, "system");

      await Promise.all(
        (room()?.tokens.filter((t) => t.characterId) ?? []).map(async (t) => {
          try {
            applySheet(t.id, await characterService.get(t.characterId!, { id: gm.id }), true);
          } catch {
            // Sheet no longer reachable (deleted, left the campaign): keep the token as it is.
          }
        }),
      );
    }

    function startCombat() {
      const state = room();
      if (!state) return;
      if (!combatWinner(state.tokens) && state.tokens.length > 1) send(rollInitiative(state));
      else toast.info("Não há dois lados em pé para combater.");
    }

    function nextTurn() {
      const state = room();
      if (!state?.combat.active) return;
      const winner = combatWinner(state.tokens);
      if (winner) return endCombat(winner === "party" ? "Vitória! O grupo venceu o combate." : "O grupo foi derrotado…");
      send([{ type: "combat.turn" }]);
    }

    function endCombat(text = "O combate terminou.") {
      send([{ type: "combat.ended" }, announce(text)]);
    }

    function addBots() {
      const state = room();
      if (!state) return;
      const events = botJoinEvents(state);
      if (events.length === 0) return void toast.info("Todos os bots já estão na mesa.");
      send(events, "bots");
    }

    function removeBots() {
      const bots = room()?.tokens.filter((t) => t.controller === "bot") ?? [];
      if (bots.length === 0) return;
      send([...bots.map((b): RoomEvent => ({ type: "token.removed", tokenId: b.id })), announce("Os jogadores bot saíram da sala.")]);
    }

    /** Marks where a character should go (players' movement requests); one ping per author. */
    function ping(cell: Cell, tokenId?: string) {
      const state = room();
      if (!state || cell.x < 0 || cell.y < 0 || cell.x >= state.map.cols || cell.y >= state.map.rows) return;
      send([{ type: "ping.placed", ping: { id: createId("ping"), x: cell.x, y: cell.y, author: gm, tokenId, at: new Date().toISOString() } }]);
    }

    function clearPing(pingId: string) {
      send([{ type: "ping.cleared", pingId }]);
    }

    function markEpic(text: string) {
      send([epicMoment(gm, text.trim() || "Momento épico!")]);
      toast.success("Momento épico marcado", "Registrado no log da sessão para o Chronicles Studio.");
    }

    /** A check rolled on a character sheet, posted to the chat as that character. */
    function postCheck(token: RoomToken, check: CheckResult) {
      send([checkEvent(authorOf(token), check.result, check.outcome ? `${check.label} — ${check.outcome}` : check.label)], token.id);
    }

    function setAppearance(token: RoomToken, modelId: string) {
      send([{ type: "token.appearance", tokenId: token.id, modelId }]);
    }

    /** Puts music on for everyone (a theme or an uploaded track), from the start. */
    function playMusic(source: MusicCue["source"], ref: string, title: string, options: { loop?: boolean; volume?: number } = {}) {
      const volume = options.volume ?? room()?.audio?.music?.volume ?? 0.8;
      send([{ type: "audio.music", music: { id: createId("cue"), source, ref, title, startedAt: new Date().toISOString(), volume, loop: options.loop ?? true } }]);
    }

    function stopMusic() {
      send([{ type: "audio.music", music: null }]);
    }

    /** Same cue (no restart), new level or loop setting. */
    function tuneMusic(patch: Partial<Pick<MusicCue, "volume" | "loop">>) {
      const music = room()?.audio?.music;
      if (music) send([{ type: "audio.music", music: { ...music, ...patch } }]);
    }

    function setAmbience(ambience: AmbienceLayer[]) {
      send([{ type: "audio.ambience", ambience }]);
    }

    function setLayer(id: string, volume: number | null) {
      send([{ type: "audio.layer", id, volume }]);
    }

    function silence() {
      send([{ type: "audio.music", music: null }, { type: "audio.ambience", ambience: [] }]);
    }

    /** Puts a map on the table; characters placed on it in the editor (and new to the table) join as tokens. */
    function replaceMap(map: MapDocument, npcs: Npc[] = []) {
      const state = room();
      const joining = state ? spawnTokens(map, state.map, state.rules, state.tokens, npcs) : [];
      send([{ type: "map.replaced", map }, ...joining.map((token): RoomEvent => ({ type: "token.added", token })), announce(`O mestre atualizou o mapa: ${map.name}.`)]);
      toast.success("Mapa aplicado", joining.length ? `${map.name} · ${joining.length} personagem(ns) na mesa` : map.name);
    }

    return { addTokens, post, setAmbient, setTokenLight, toggleLight, toggleDoor, setDoorLocked, updateTrap, configureFog, revealCells, hideCells, revealAll: () => revealCells(allCells()), hideAll: () => hideCells(allCells()), setRules, applySheetSoon, refreshFromSheet, forgetSheet, syncSheets, postCheck, setAppearance, replaceMap, playMusic, stopMusic, tuneMusic, setAmbience, setLayer, silence, rollDice, sendChat, moveToken, adjustHp, toggleCondition, attackWith, startCombat, nextTurn, endCombat, addBots, removeBots, markEpic, ping, clearPing };
  }, [campaignId, gm, dispatch, forward]);
}

export type RoomActions = ReturnType<typeof useRoomActions>;
