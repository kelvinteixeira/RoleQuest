"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChronicleEpisode, EpisodeScript } from "@/types/chronicle";
import { musicKey, musicPlan, voiceFits, type SceneVoice } from "../model/audio-mix";
import { renderSoundtrack } from "./synth";

/**
 * The soundtrack of a script as an object URL. Re-rendered (a moment after the
 * last edit) only when the timing or the moods change, not the text.
 */
export function useSoundtrack(script: EpisodeScript): string | null {
  const key = musicKey(script);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    const scenes = script.scenes;
    const timer = setTimeout(() => {
      renderSoundtrack(musicPlan({ scenes }))
        .then((blob) => {
          if (!alive) return;
          made = URL.createObjectURL(blob);
          setUrl(made);
        })
        .catch((e) => console.warn("Chronicles: trilha sonora", e));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
      // Released a little later: the player may still hold it until the new one arrives.
      const old = made;
      if (old) setTimeout(() => URL.revokeObjectURL(old), 10_000);
    };
    // The music depends only on what `key` captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

/** Object URLs for blobs (key -> URL), released when the blobs change or the component goes. */
export function useObjectUrls(blobs: Record<string, Blob> | null): Record<string, string> {
  const urls = useMemo(() => Object.fromEntries(Object.entries(blobs ?? {}).map(([k, b]) => [k, URL.createObjectURL(b)])), [blobs]);
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export type VoiceTrack = SceneVoice & { url: string };

/** The recorded narration that still matches each scene's caption (scene id -> clip). */
export function playableVoices(script: EpisodeScript, voices: ChronicleEpisode["voices"], urls: Record<string, string>): Record<string, VoiceTrack> {
  const out: Record<string, VoiceTrack> = {};
  for (const scene of script.scenes) {
    const voice = voices[scene.id];
    if (voiceFits(scene, voice) && urls[scene.id]) out[scene.id] = { text: voice.text, seconds: voice.seconds, url: urls[scene.id] };
  }
  return out;
}
