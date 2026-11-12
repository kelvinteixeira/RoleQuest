"use client";

import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { EpisodeScript } from "@/types/chronicle";
import { NARRATION_START, sceneStarts } from "../model/audio-mix";
import { EpisodeVideo, FPS, HEIGHT, WIDTH, episodeFrames, type EpisodeVideoProps } from "../video/episode-video";

/** A Portuguese voice of this browser, if it has one. */
function narratorVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "pt-BR") ?? voices.find((v) => v.lang.startsWith("pt")) ?? null;
}

/**
 * Captions without a recorded narration are read by the browser's own voice
 * (Web Speech) as their scene starts playing. Preview only: the exported MP4
 * carries just the recorded narration.
 */
function useBrowserNarrator(player: React.RefObject<PlayerRef | null>, script: EpisodeScript, recorded: Record<string, unknown>) {
  useEffect(() => {
    const p = player.current;
    if (!p || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const starts = sceneStarts(script);
    let spoken = -1;
    const stop = () => {
      synth.cancel();
      spoken = -1;
    };
    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      if (!p.isPlaying()) return;
      const i = starts.findLastIndex((s) => s <= detail.frame);
      if (i < 0 || i === spoken) return;
      const scene = script.scenes[i];
      const into = detail.frame - starts[i];
      // Only from the scene's beginning (not after a jump into its middle).
      if (into < NARRATION_START || into > NARRATION_START + FPS) return;
      spoken = i;
      synth.cancel();
      if (recorded[scene.id] || !scene.narration.trim() || p.isMuted()) return;
      const line = new SpeechSynthesisUtterance(scene.narration);
      line.lang = "pt-BR";
      const voice = narratorVoice();
      if (voice) line.voice = voice;
      line.rate = 1.05;
      line.volume = p.getVolume();
      synth.speak(line);
    };
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("pause", stop);
    p.addEventListener("seeked", stop);
    p.addEventListener("ended", stop);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("pause", stop);
      p.removeEventListener("seeked", stop);
      p.removeEventListener("ended", stop);
      synth.cancel();
    };
  }, [player, script, recorded]);
}

/** The episode preview (Remotion Player): play, scrub, full screen, with music and narration. */
export default function EpisodePlayer({ script, images, campaignName, music = null, voices = {}, watermark = false }: Pick<EpisodeVideoProps, "script" | "images" | "campaignName" | "music" | "voices" | "watermark">) {
  const ref = useRef<PlayerRef>(null);
  const inputProps = useMemo(() => ({ script, images, campaignName, music, voices, watermark }), [script, images, campaignName, music, voices, watermark]);
  useBrowserNarrator(ref, script, voices);
  return (
    <Player
      ref={ref}
      component={EpisodeVideo}
      inputProps={inputProps}
      durationInFrames={episodeFrames(script)}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      controls
      allowFullscreen
      clickToPlay
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", backgroundColor: "#06050a" }}
    />
  );
}
