"use client";

/**
 * The episode as a Remotion composition: cinema meets comics. Each scene is
 * an illustrated panel with a camera move, a caption box, speech balloons, an
 * onomatopoeia, and — for decisive rolls — a giant d20. It renders the same in
 * the Player (preview) and in the browser export (renderMediaOnWeb), so it
 * sticks to what client-side rendering supports: no z-index (DOM order), only
 * linear gradients, system fonts, SVG as <Img> data URIs.
 */
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { EpisodeScene, EpisodeScript, SceneMood } from "@/types/chronicle";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export interface EpisodeVideoProps extends Record<string, unknown> {
  script: EpisodeScript;
  /** Image key -> object URL (scenes by id). */
  images: Record<string, string>;
  campaignName: string;
}

export const episodeFrames = (script: Pick<EpisodeScript, "scenes">) => Math.max(1, script.scenes.reduce((n, s) => n + s.seconds * FPS, 0));

const FONT_TITLE = "Georgia, 'Times New Roman', serif";
const FONT_COMIC = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const FONT_SFX = "Impact, 'Arial Black', sans-serif";

const GRADE: Record<SceneMood, string> = {
  calm: "linear-gradient(180deg, rgba(40,80,140,0.18), rgba(10,20,40,0.35))",
  tense: "linear-gradient(180deg, rgba(90,20,80,0.25), rgba(10,0,20,0.5))",
  epic: "linear-gradient(180deg, rgba(255,150,40,0.18), rgba(40,10,0,0.45))",
  dark: "linear-gradient(180deg, rgba(0,10,20,0.45), rgba(0,0,0,0.65))",
  triumphant: "linear-gradient(180deg, rgba(255,210,90,0.22), rgba(60,30,0,0.35))",
  funny: "linear-gradient(180deg, rgba(120,255,200,0.12), rgba(0,40,30,0.3))",
};

function d20Svg(color: string, glow: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<polygon points="100,6 182,53 182,147 100,194 18,147 18,53" fill="${color}" stroke="${glow}" stroke-width="6"/>
<polygon points="100,40 155,130 45,130" fill="none" stroke="${glow}" stroke-width="4" opacity="0.85"/>
<path d="M100 6 L100 40 M182 53 L155 130 M182 147 L155 130 M100 194 L100 165 M18 147 L45 130 M18 53 L45 130 M45 130 L100 165 L155 130" stroke="${glow}" stroke-width="3" fill="none" opacity="0.6"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Camera move over the panel: scale and offset at progress p (0..1). */
function camera(scene: EpisodeScene, p: number): string {
  const e = Easing.inOut(Easing.cubic)(p);
  switch (scene.camera) {
    case "push-in":
      return `scale(${1.04 + 0.2 * e})`;
    case "pull-out":
      return `scale(${1.24 - 0.2 * e})`;
    case "pan-left":
      return `scale(1.18) translateX(${4 - 8 * e}%)`;
    case "pan-right":
      return `scale(1.18) translateX(${-4 + 8 * e}%)`;
    case "tilt-up":
      return `scale(1.18) translateY(${4 - 8 * e}%)`;
    default:
      return `scale(${1.06 + 0.03 * e})`;
  }
}

function Panel({ scene, image, index }: { scene: EpisodeScene; image?: string; index: number }) {
  const frame = useCurrentFrame();
  const duration = scene.seconds * FPS;
  const p = Math.min(1, frame / duration);
  const tilt = index % 2 === 0 ? -0.5 : 0.5;
  return (
    <AbsoluteFill style={{ padding: 34 }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", border: "10px solid #0b0b10", borderRadius: 8, transform: `rotate(${tilt}deg)`, backgroundColor: "#15121c", boxShadow: "0 18px 40px rgba(0,0,0,0.6)" }}>
        {image ? (
          <Img src={image} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", transform: camera(scene, p) }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, backgroundImage: GRADE[scene.mood] }} />
        )}
        <div style={{ position: "absolute", inset: 0, backgroundImage: GRADE[scene.mood] }} />
        {/* Vignette from the edges (linear only). */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.7) 100%)" }} />
      </div>
    </AbsoluteFill>
  );
}

function Caption({ text, duration }: { text: string; duration: number }) {
  const frame = useCurrentFrame();
  if (!text) return null;
  const words = text.split(/\s+/);
  const shown = Math.ceil(interpolate(frame, [8, Math.max(9, duration * 0.45)], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const enter = interpolate(frame, [0, 10], [-30, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 90, top: 80, maxWidth: 1000, transform: `translateY(${enter}px) rotate(-1deg)`, opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }}>
      <div style={{ backgroundColor: "#f6d86b", color: "#1a1408", border: "5px solid #111", borderRadius: 4, padding: "22px 30px", fontFamily: FONT_COMIC, fontSize: 40, fontWeight: 700, lineHeight: 1.25, boxShadow: "8px 8px 0 rgba(0,0,0,0.85)" }}>
        {words.slice(0, shown).join(" ")}
      </div>
    </div>
  );
}

const BALLOON_SPOTS = [
  { left: 140, top: 640, tail: "left" },
  { left: 980, top: 520, tail: "right" },
  { left: 560, top: 760, tail: "left" },
] as const;

function Balloon({ speaker, line, spot, start }: { speaker: string; line: string; spot: (typeof BALLOON_SPOTS)[number]; start: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start) return null;
  const pop = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", left: spot.left, top: spot.top, transform: `scale(${pop})`, transformOrigin: spot.tail === "left" ? "10% 100%" : "90% 100%" }}>
      <div style={{ position: "relative", maxWidth: 700, backgroundColor: "#ffffff", color: "#111", border: "5px solid #111", borderRadius: 48, padding: "22px 36px", fontFamily: FONT_COMIC, boxShadow: "6px 6px 0 rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 24, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>{speaker}</div>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2 }}>{line}</div>
      </div>
      {/* The tail, drawn after the balloon so it overlaps its border. */}
      <div style={{ position: "absolute", bottom: -38, [spot.tail === "left" ? "left" : "right"]: 70, width: 60, height: 44, backgroundColor: "#111", clipPath: spot.tail === "left" ? "polygon(0 0, 100% 0, 10% 100%)" : "polygon(0 0, 100% 0, 90% 100%)" }} />
      <div style={{ position: "absolute", bottom: -26, [spot.tail === "left" ? "left" : "right"]: 78, width: 44, height: 32, backgroundColor: "#fff", clipPath: spot.tail === "left" ? "polygon(0 0, 100% 0, 8% 100%)" : "polygon(0 0, 100% 0, 92% 100%)" }} />
    </div>
  );
}

function Sfx({ text, at }: { text: string; at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text || frame < at) return null;
  const pop = spring({ frame: frame - at, fps, config: { damping: 8, stiffness: 220 } });
  const fade = interpolate(frame - at, [30, 50], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", right: 140, top: 230, transform: `rotate(-9deg) scale(${0.4 + pop * 0.8})`, opacity: fade, fontFamily: FONT_SFX, fontSize: 190, color: "#ffd93b", WebkitTextStroke: "8px #1a0b00", textShadow: "10px 10px 0 #b8202a", letterSpacing: 4 }}>
      {text}
    </div>
  );
}

function RollBeat({ scene }: { scene: EpisodeScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const roll = scene.roll!;
  const crit = roll.natural === 20;
  const fumble = roll.natural === 1;
  const color = crit ? "#b8860b" : fumble ? "#7f1d1d" : "#4c1d95";
  const glow = crit ? "#fde68a" : fumble ? "#fca5a5" : "#e9d5ff";
  const enter = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 120 } });
  const spin = interpolate(frame, [6, 40], [720, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const reveal = interpolate(frame, [36, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stamp = spring({ frame: frame - 46, fps, config: { damping: 9, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75))" }}>
      <div style={{ position: "relative", width: 420, height: 420, transform: `scale(${enter}) rotate(${spin}deg)`, filter: `drop-shadow(0 0 ${crit ? 60 : 24}px ${glow})` }}>
        <Img src={d20Svg(color, glow)} style={{ width: 420, height: 420 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 420, height: 420, display: "flex", alignItems: "center", justifyContent: "center", opacity: reveal, fontFamily: FONT_SFX, fontSize: 150, color: "#fff", textShadow: "0 6px 0 rgba(0,0,0,0.7)" }}>
          {roll.natural}
        </div>
      </div>
      <div style={{ marginTop: 40, opacity: reveal, fontFamily: FONT_COMIC, fontSize: 44, fontWeight: 700, color: "#fff", textShadow: "0 4px 12px rgba(0,0,0,0.9)" }}>
        {roll.label} <span style={{ color: glow }}>= {roll.total}</span>
      </div>
      {(crit || fumble) && (
        <div style={{ position: "absolute", top: 130, transform: `rotate(-6deg) scale(${stamp})`, fontFamily: FONT_SFX, fontSize: 130, letterSpacing: 6, color: crit ? "#fde047" : "#f87171", WebkitTextStroke: "6px #1a0b00", textShadow: "8px 8px 0 rgba(0,0,0,0.8)" }}>
          {crit ? "CRÍTICO!" : "FALHA CRÍTICA!"}
        </div>
      )}
    </AbsoluteFill>
  );
}

function TitleCard({ script, campaignName, image }: { script: EpisodeScript; campaignName: string; image?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = interpolate(frame, [0, 20], [0, 120], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const title = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  const sub = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#06050a" }}>
      {image && <Img src={image} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, transform: `scale(${1.05 + frame * 0.0012})` }} />}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(6,5,10,0.2), rgba(6,5,10,0.85))" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 160 }}>
        <div style={{ fontFamily: FONT_COMIC, fontSize: 34, letterSpacing: 14, textTransform: "uppercase", color: "#c4b5fd", opacity: sub }}>{campaignName}</div>
        <div style={{ marginTop: 24, fontFamily: FONT_TITLE, fontSize: 120, fontWeight: 700, color: "#fff", lineHeight: 1.05, transform: `scale(${0.8 + title * 0.2})`, opacity: title, textShadow: "0 8px 30px rgba(0,0,0,0.8)" }}>
          {script.title}
        </div>
        {script.logline && <div style={{ marginTop: 34, maxWidth: 1300, fontFamily: FONT_TITLE, fontStyle: "italic", fontSize: 40, color: "#e5e1f0", opacity: sub }}>{script.logline}</div>}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: bars, backgroundColor: "#000" }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: bars, backgroundColor: "#000" }} />
    </AbsoluteFill>
  );
}

function EndCard({ scene, script }: { scene: EpisodeScene; script: EpisodeScript }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const word = spring({ frame: frame - 20, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 170, textAlign: "center", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85))" }}>
      <div style={{ fontFamily: FONT_TITLE, fontStyle: "italic", fontSize: 92, color: "#fff", transform: `scale(${word})`, textShadow: "0 8px 30px rgba(0,0,0,0.9)" }}>Continua…</div>
      <div style={{ marginTop: 30, fontFamily: FONT_COMIC, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#c4b5fd", opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {script.characters.map((c) => c.name).join(" · ") || scene.narration}
      </div>
    </AbsoluteFill>
  );
}

function SceneView({ scene, index, script, images, campaignName }: { scene: EpisodeScene; index: number; script: EpisodeScript; images: Record<string, string>; campaignName: string }) {
  const frame = useCurrentFrame();
  const duration = scene.seconds * FPS;
  const fade = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const image = images[scene.id];
  if (scene.kind === "title") {
    return (
      <AbsoluteFill style={{ opacity: fade }}>
        <TitleCard script={script} campaignName={campaignName} image={image} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: fade, backgroundColor: "#0a0910" }}>
      <Panel scene={scene} image={image} index={index} />
      {scene.kind === "roll" && scene.roll ? <RollBeat scene={scene} /> : null}
      {scene.kind === "end" ? <EndCard scene={scene} script={script} /> : <Caption text={scene.narration} duration={duration} />}
      {scene.kind !== "end" &&
        scene.dialogue.slice(0, 3).map((d, i) => <Balloon key={i} speaker={d.speaker} line={d.line} spot={BALLOON_SPOTS[i % BALLOON_SPOTS.length]} start={Math.round(duration * 0.3) + i * 26} />)}
      {scene.kind === "scene" && <Sfx text={scene.sfx} at={Math.round(duration * 0.22)} />}
      <div style={{ position: "absolute", right: 60, bottom: 44, fontFamily: FONT_COMIC, fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{campaignName}</div>
    </AbsoluteFill>
  );
}

/** The whole episode: one sequence per scene, back to back. */
export function EpisodeVideo({ script, images, campaignName }: EpisodeVideoProps) {
  const starts = script.scenes.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + script.scenes[i - 1].seconds * FPS], []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#06050a" }}>
      {script.scenes.map((scene, i) => (
        <Sequence key={scene.id} from={starts[i]} durationInFrames={scene.seconds * FPS}>
          <SceneView scene={scene} index={i} script={script} images={images} campaignName={campaignName} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
