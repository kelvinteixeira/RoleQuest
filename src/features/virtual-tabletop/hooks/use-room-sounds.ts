"use client";

import { useEffect, useRef } from "react";
import { playSfx, setEffectsVolume } from "@/features/audio-engine/sfx";
import { usePreferencesStore } from "@/stores/preferences.store";
import { useRoomStore } from "../store/room.store";

/** Plays the sounds of each new batch of table events, following the player's sound preferences. */
export function useRoomSounds() {
  const sounds = useRoomStore((s) => s.sounds);
  const enabled = usePreferencesStore((s) => s.diceSounds);
  const volume = usePreferencesStore((s) => s.effectsVolume);

  useEffect(() => {
    if (enabled) setEffectsVolume(volume);
  }, [enabled, volume]);

  // Each batch plays once, when it arrives: not again on unmute, a volume change or re-entering the room.
  const played = useRef(sounds?.id ?? null);
  useEffect(() => {
    if (!sounds || sounds.id === played.current) return;
    played.current = sounds.id;
    const prefs = usePreferencesStore.getState();
    if (!prefs.diceSounds || prefs.effectsVolume === 0) return;
    sounds.names.forEach((name, i) => playSfx(name, i * 0.06));
  }, [sounds]);
}
