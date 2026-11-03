"use client";

import { useEffect, useRef } from "react";
import { combatWinner, currentTurnToken, announce } from "../model/room-engine";
import { decideTurn, idleChatter, whisperReply } from "../model/bots";
import { BOT_DELAY, useRoomStore } from "../store/room.store";

const IDLE_CHATTER_MS = 11000;

/**
 * Drives local bots: plays their turns (and enemy turns when automated),
 * ends combat when a side falls, chats out of combat and answers whispers.
 * Every action goes through the same dispatch the GM uses.
 */
export function useBotDirector(campaignId: string, gm: { id: string; name: string }) {
  const room = useRoomStore((s) => s.rooms[campaignId]);
  const running = useRoomStore((s) => s.botsRunning);
  const speed = useRoomStore((s) => s.botSpeed);
  const autoEnemies = useRoomStore((s) => s.autoEnemies);
  const dispatch = useRoomStore((s) => s.dispatch);
  const answered = useRef(new Set<string>());

  const turnKey = room?.combat.active ? `${room.combat.round}:${room.combat.turn}` : null;
  const actor = room ? currentTurnToken(room) : null;
  const automated = !!actor && (actor.controller === "bot" || (actor.kind === "enemy" && autoEnemies));

  // Turns.
  useEffect(() => {
    if (!running || !turnKey || !automated) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        const state = useRoomStore.getState().rooms[campaignId];
        const current = state && currentTurnToken(state);
        if (!state || !current) return;
        let elapsed = 0;
        for (const step of decideTurn(state, current)) {
          elapsed += step.delay;
          timers.push(setTimeout(() => dispatch(campaignId, current.id, step.events), elapsed));
        }
        timers.push(
          setTimeout(() => {
            const after = useRoomStore.getState().rooms[campaignId];
            if (!after?.combat.active) return;
            const winner = combatWinner(after.tokens);
            if (winner) {
              dispatch(campaignId, "system", [
                { type: "combat.ended" },
                announce(winner === "party" ? "Vitória! O grupo venceu o combate." : "O grupo foi derrotado…"),
              ]);
            } else {
              dispatch(campaignId, current.id, [{ type: "combat.turn" }]);
            }
          }, elapsed + 600),
        );
      }, BOT_DELAY[speed]),
    );
    return () => timers.forEach(clearTimeout);
  }, [running, turnKey, automated, speed, campaignId, dispatch]);

  // Idle chatter outside combat.
  const inCombat = !!room?.combat.active;
  useEffect(() => {
    if (!running || inCombat) return;
    const timer = setInterval(() => {
      const state = useRoomStore.getState().rooms[campaignId];
      if (state && Math.random() < 0.6) dispatch(campaignId, "bots", idleChatter(state));
    }, IDLE_CHATTER_MS);
    return () => clearInterval(timer);
  }, [running, inCombat, campaignId, dispatch]);

  // Whisper replies: answer each GM whisper sent to a bot once.
  const lastMessage = room?.messages[room.messages.length - 1];
  useEffect(() => {
    if (!lastMessage || lastMessage.kind !== "whisper" || lastMessage.author.id !== gm.id || !lastMessage.to) return;
    if (answered.current.has(lastMessage.id)) return;
    answered.current.add(lastMessage.id);
    const botId = lastMessage.to.id;
    const timer = setTimeout(() => {
      const state = useRoomStore.getState().rooms[campaignId];
      if (state) dispatch(campaignId, botId, whisperReply(state, botId, gm));
    }, 1600);
    return () => clearTimeout(timer);
  }, [lastMessage, gm, campaignId, dispatch]);
}
