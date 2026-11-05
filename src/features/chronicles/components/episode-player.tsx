"use client";

import { Player } from "@remotion/player";
import type { EpisodeScript } from "@/types/chronicle";
import { EpisodeVideo, FPS, HEIGHT, WIDTH, episodeFrames } from "../video/episode-video";

/** The episode preview (Remotion Player): play, scrub, full screen. */
export default function EpisodePlayer({ script, images, campaignName }: { script: EpisodeScript; images: Record<string, string>; campaignName: string }) {
  return (
    <Player
      component={EpisodeVideo}
      inputProps={{ script, images, campaignName }}
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
