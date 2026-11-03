"use client";

import { useMemo } from "react";
import { DiceFormulaError, type RollMode } from "@/features/dice/dice-engine";
import { toast } from "@/stores/toast.store";
import { botJoinEvents } from "../model/bots";
import type { Cell } from "../model/map";
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
  rollInitiative,
  say,
  whisper,
} from "../model/room-engine";
import type { MapDocument } from "@/features/map/model/map-document";
import type { Author, MessageVisibility, RoomEvent, RoomToken } from "../model/types";
import { useRoomStore } from "../store/room.store";

const SHEET_SYNC_MS = 400;
const sheetTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** GM actions for one room. Each one becomes RoomEvents through the store. */
export function useRoomActions(campaignId: string, gm: Author) {
  const dispatch = useRoomStore((s) => s.dispatch);

  return useMemo(() => {
    const room = () => useRoomStore.getState().rooms[campaignId];
    const send = (events: RoomEvent[], actorId = gm.id) => dispatch(campaignId, actorId, events);

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
    function sendChat(text: string, whisperTo?: RoomToken) {
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

    function moveToken(token: RoomToken, cell: Cell) {
      send([{ type: "token.moved", tokenId: token.id, x: cell.x, y: cell.y }]);
    }

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

    /** Refreshes a player token from its sheet (attacks, defense, max HP) when something changed. */
    function applySheet(tokenId: string, { character, system }: Pick<EditableCharacter, "character" | "system">) {
      const token = room()?.tokens.find((t) => t.id === tokenId);
      if (!token) return;
      const stats = { ...combatProfile(system, character.sheet, character.level), heals: token.stats.heals };
      const hpMax = sheetHitPoints(system, character.sheet)?.max ?? token.hp.max;
      if (hpMax === token.hp.max && JSON.stringify(stats) === JSON.stringify(token.stats)) return;
      send([{ type: "token.synced", tokenId, stats, hpMax }], "system");
    }

    /** Sheet edits arrive per keystroke; the token follows a moment later. */
    function applySheetSoon(tokenId: string, data: Pick<EditableCharacter, "character" | "system">) {
      clearTimeout(sheetTimers.get(tokenId));
      sheetTimers.set(tokenId, setTimeout(() => applySheet(tokenId, data), SHEET_SYNC_MS));
    }

    /** Pulls every player token's sheet (edited outside the room since it was set up). */
    async function syncSheets() {
      const tokens = room()?.tokens.filter((t) => t.characterId) ?? [];
      await Promise.all(
        tokens.map(async (t) => {
          try {
            applySheet(t.id, await characterService.get(t.characterId!, { id: gm.id }));
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

    function replaceMap(map: MapDocument) {
      send([{ type: "map.replaced", map }, announce(`O mestre atualizou o mapa: ${map.name}.`)]);
      toast.success("Mapa aplicado", map.name);
    }

    return { setRules, applySheetSoon, syncSheets, postCheck, setAppearance, replaceMap, rollDice, sendChat, moveToken, adjustHp, toggleCondition, attackWith, startCombat, nextTurn, endCombat, addBots, removeBots, markEpic };
  }, [campaignId, gm, dispatch]);
}

export type RoomActions = ReturnType<typeof useRoomActions>;
