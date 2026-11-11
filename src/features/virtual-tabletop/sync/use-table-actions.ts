"use client";

import { useEffect, useMemo, useRef } from "react";
import { DiceFormulaError, parseFormula } from "@/features/dice/dice-engine";
import type { CheckRequest } from "@/features/character-sheet/model/checks";
import { toast } from "@/stores/toast.store";
import { useRoomActions, type RoomActions } from "../hooks/use-room-actions";
import type { Author, RoomEvent } from "../model/types";
import { useRoomStore } from "../store/room.store";
import type { RoomSync } from "./use-room-sync";

const SHEET_INTENT_MS = 700;

/** RoomActions plus what only a table hosted elsewhere needs. */
export type TableActions = RoomActions & {
  /** At a hosted table a player's sheet asks the host to roll its checks. */
  requestCheck?: (tokenId: string, request: CheckRequest) => void;
};

/**
 * The actions the table offers to this client:
 * - host or local mode: the GM's actions, applied here;
 * - a GM following someone else's table: the same actions, forwarded to the host;
 * - a player: talks, rolls, attacks and checks with their character, and pings
 *   where they want to go; the map, scene, sound and tokens stay with the GM.
 *   At a hosted table these go to the host as intents it validates.
 */
export function useTableActions(campaignId: string, author: Author, sync: RoomSync, isGM: boolean): TableActions {
  const forwarding = sync.mode === "guest" && isGM;
  const forward = useMemo(
    () => (forwarding ? (events: RoomEvent[], actorId: string) => sync.send({ kind: "events", events, actorId }) : undefined),
    // `sync.send` only closes over the campaign and the repository.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forwarding, campaignId],
  );
  const gmActions = useRoomActions(campaignId, author, forward);
  const sendRef = useRef(sync.send);
  useEffect(() => {
    sendRef.current = sync.send;
  });
  const sheetTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  return useMemo(() => {
    if (isGM) return gmActions;
    const gmOnly = (): undefined => void toast.info("Só o mestre faz isso.");
    const askGm = () => void toast.info("O mestre move os personagens", "Clique no chão para marcar aonde quer ir.");

    // A player never handles the map, the scene, the sound or anyone's token: that is the GM's table.
    const locked: TableActions = {
      ...gmActions,
      addTokens: gmOnly,
      post: () => "",
      setAmbient: gmOnly,
      setTokenLight: gmOnly,
      toggleLight: gmOnly,
      toggleDoor: () => void toast.info("Só o mestre mexe no mapa", "Peça no chat para abrir a porta."),
      setDoorLocked: gmOnly,
      updateTrap: gmOnly,
      configureFog: gmOnly,
      revealCells: gmOnly,
      hideCells: gmOnly,
      revealAll: gmOnly,
      hideAll: gmOnly,
      setAppearance: gmOnly,
      replaceMap: gmOnly,
      adjustHp: gmOnly,
      toggleCondition: gmOnly,
      startCombat: gmOnly,
      nextTurn: gmOnly,
      endCombat: gmOnly,
      addBots: gmOnly,
      removeBots: gmOnly,
      markEpic: gmOnly,
      playMusic: gmOnly,
      stopMusic: gmOnly,
      tuneMusic: gmOnly,
      setAmbience: gmOnly,
      setLayer: gmOnly,
      silence: gmOnly,
      moveToken: askGm,
      // Only their own ping comes off.
      clearPing: (pingId) => {
        const mine = useRoomStore.getState().rooms[campaignId]?.pings?.find((p) => p.id === pingId && p.author.id === author.id);
        if (mine) gmActions.clearPing(pingId);
      },
    };
    // Local mode: this browser runs the table, so what a player may do applies here.
    if (sync.mode !== "guest") return locked;

    const send: RoomSync["send"] = (intent) => sendRef.current(intent);
    const validFormula = (formula: string) => {
      try {
        parseFormula(formula);
        return true;
      } catch (error) {
        toast.error("Fórmula de dados inválida", error instanceof DiceFormulaError ? error.message : formula);
        return false;
      }
    };

    const player: TableActions = {
      ...locked,
      setRules: () => undefined,
      syncSheets: async () => undefined,
      forgetSheet: () => undefined,

      ping: (cell) => void send({ kind: "ping", x: cell.x, y: cell.y }),
      clearPing: () => void send({ kind: "unping" }),
      attackWith: (attacker, target, attackId) => void send({ kind: "attack", attackerId: attacker.id, targetId: target.id, attackId }),
      rollDice: (formula, options = {}) => {
        const clean = formula.replace(/\s+/g, "");
        if (!clean || !validFormula(clean)) return false;
        send({ kind: "roll", formula: clean, label: options.label, mode: options.mode, secret: options.visibility === "gm" });
        return true;
      },
      sendChat: (text, whisperTo) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const [command, ...rest] = trimmed.split(/\s+/);
        if (command === "/r" || command === "/roll") return void player.rollDice(rest.join(""));
        if (command === "/gm") return void player.rollDice(rest.join(""), { visibility: "gm", label: "Rolagem secreta" });
        if (command === "/w") return void send({ kind: "chat", text: rest.join(" "), toGm: true });
        send({ kind: "chat", text: trimmed, toGm: !!whisperTo });
      },
      // A check rolled on the sheet is rolled by the host (the sheet only says which).
      postCheck: () => undefined,
      requestCheck: (tokenId, request) => send({ kind: "check", tokenId, request }),
      // Sheet edits are saved by the sheet itself; the host then refreshes the token from it.
      applySheetSoon: (tokenId) => {
        const timers = sheetTimers.current;
        clearTimeout(timers.get(tokenId));
        timers.set(
          tokenId,
          setTimeout(() => send({ kind: "sheet", tokenId }), SHEET_INTENT_MS),
        );
      },
    };
    return player;
  }, [gmActions, isGM, sync.mode, campaignId, author.id]);
}
