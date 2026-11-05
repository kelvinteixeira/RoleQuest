"use client";

import { useEffect, useState } from "react";
import { applyTableAudio, restartMusic, setListenerVolumes, stopTableAudio } from "@/features/audio-engine/mixer";
import { audioLocked, unlockAudio } from "@/features/audio-engine/sfx";
import { audioService } from "@/services/audio.service";
import { usePreferencesStore } from "@/stores/preferences.store";
import type { TableAudio } from "../model/types";

/**
 * Plays what the GM put on at the table (music and ambience), at this
 * listener's volumes. Returns whether the browser is still waiting for a click
 * before it may play sound (autoplay rules).
 */
export function useTableAudio(audio: TableAudio | undefined): { locked: boolean; unlock: () => void } {
  const musicVolume = usePreferencesStore((s) => s.musicVolume);
  const ambienceVolume = usePreferencesStore((s) => s.ambienceVolume);
  const [locked, setLocked] = useState(false);
  const key = JSON.stringify(audio ?? null);
  const audible = !!audio && (!!audio.music || (audio.ambience?.length ?? 0) > 0);

  useEffect(() => {
    setListenerVolumes({ music: musicVolume, ambience: ambienceVolume });
  }, [musicVolume, ambienceVolume]);

  useEffect(() => {
    if (!audio) return;
    void applyTableAudio(audio, audioService.file);
    // A short look after starting: is the browser holding the sound back?
    const check = setTimeout(() => setLocked(audible && audioLocked()), 400);
    return () => clearTimeout(check);
    // `key` stands for `audio` (a new object on every view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => stopTableAudio(), []);

  return {
    locked,
    unlock: () => {
      setLocked(false);
      void unlockAudio().then(() => {
        // Music started while held back is behind the table: start it again at the table's point.
        restartMusic();
        if (audio) void applyTableAudio(audio, audioService.file);
      });
    },
  };
}
