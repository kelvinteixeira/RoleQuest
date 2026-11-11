/**
 * The episode's sound: when things happen on screen (shared with the video),
 * the score written for the scenes' moods, and the music level that ducks
 * under the narration and the balloons so both stay audible.
 */
import type { EpisodeScene, EpisodeScript, SceneMood } from "@/types/chronicle";

export const FPS = 30;

/** Frame (inside a scene) where the caption box appears and the narrator starts. */
export const NARRATION_START = 8;
/** Frame (inside a roll scene) where the die lands and shows its number. */
export const ROLL_REVEAL = 46;
export const balloonStart = (sceneFrames: number, index: number) => Math.round(sceneFrames * 0.3) + index * 26;
export const sfxStart = (sceneFrames: number) => Math.round(sceneFrames * 0.22);

/** First frame of each scene. */
export function sceneStarts(script: Pick<EpisodeScript, "scenes">): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const scene of script.scenes) {
    starts.push(at);
    at += scene.seconds * FPS;
  }
  return starts;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** About how long a caption takes to read aloud (narrator pace), in seconds; 0 for none. */
export const speechSeconds = (text: string) => (words(text) ? words(text) / 2.6 + 0.4 : 0);

/** The narration that plays for a scene: a recorded clip only while it still matches the caption. */
export type SceneVoice = { text: string; seconds: number };
export const voiceFits = (scene: Pick<EpisodeScene, "narration">, voice: SceneVoice | undefined): voice is SceneVoice => !!voice && !!scene.narration.trim() && voice.text === scene.narration;

/** Frames where someone is talking: the narrator (recorded or read by the browser) and the balloons being read. */
export function speechWindows(script: Pick<EpisodeScript, "scenes">, voices: Record<string, SceneVoice> = {}): { from: number; to: number }[] {
  const starts = sceneStarts(script);
  return script.scenes.flatMap((scene, i) => {
    const start = starts[i];
    const length = scene.seconds * FPS;
    const end = start + length;
    const windows: { from: number; to: number }[] = [];
    const voice = voices[scene.id];
    const said = voiceFits(scene, voice) ? voice.seconds : speechSeconds(scene.narration);
    if (said > 0) windows.push({ from: start + NARRATION_START, to: Math.min(end, start + NARRATION_START + Math.round(said * FPS)) });
    if (scene.kind !== "end") {
      scene.dialogue.slice(0, 3).forEach((d, j) => {
        const from = start + balloonStart(length, j);
        if (from < end) windows.push({ from, to: Math.min(end, from + Math.round((words(d.line) / 3 + 1) * FPS)) });
      });
    }
    return windows;
  });
}

export const MUSIC_LEVEL = 0.55;
export const MUSIC_DUCKED = 0.14;
const RAMP = 9;
const FADE_IN = 15;
const FADE_OUT = 45;

/** Music volume at a frame: ducked (with short ramps) while someone talks, faded in and out at the ends. */
export function musicVolume(frame: number, totalFrames: number, windows: { from: number; to: number }[]): number {
  let duck = 0;
  for (const w of windows) {
    if (frame < w.from - RAMP || frame > w.to + RAMP) continue;
    const d = frame < w.from ? (frame - (w.from - RAMP)) / RAMP : frame > w.to ? (w.to + RAMP - frame) / RAMP : 1;
    duck = Math.max(duck, d);
    if (duck === 1) break;
  }
  const edge = Math.min(1, Math.max(0, frame / FADE_IN), Math.max(0, (totalFrames - frame) / FADE_OUT));
  return (MUSIC_LEVEL - (MUSIC_LEVEL - MUSIC_DUCKED) * duck) * edge;
}

// ---------------------------------------------------------------------------
// The score: one held chord per scene, coloured by its mood, with a pulse for
// the restless moods and hits on the big moments (title, sfx, the die landing).
// ---------------------------------------------------------------------------

export interface MoodVoicing {
  /** MIDI notes of the chord. */
  chord: number[];
  /** Pulses per second (0: none). */
  pulse: number;
  /** "kick": low drum; "pluck": short notes walking the chord; "heart": a double beat. */
  pulseKind: "kick" | "pluck" | "heart";
  /** Low-pass cutoff of the pad (Hz): darker moods are muffled. */
  brightness: number;
}

export const MOOD_VOICING: Record<SceneMood, MoodVoicing> = {
  calm: { chord: [50, 57, 62, 66, 69], pulse: 0, pulseKind: "pluck", brightness: 900 },
  tense: { chord: [48, 54, 60, 63], pulse: 1.2, pulseKind: "heart", brightness: 600 },
  epic: { chord: [38, 50, 57, 62, 65], pulse: 2, pulseKind: "kick", brightness: 1300 },
  dark: { chord: [36, 43, 48, 51], pulse: 0, pulseKind: "heart", brightness: 420 },
  triumphant: { chord: [48, 55, 60, 64, 67, 72], pulse: 2, pulseKind: "kick", brightness: 1700 },
  funny: { chord: [53, 57, 60, 65], pulse: 4, pulseKind: "pluck", brightness: 1500 },
};

/** Moves between chords so consecutive scenes don't sit on the same one. */
const PROGRESSION = [0, 5, 3, -2];

export interface MusicSegment {
  from: number;
  to: number;
  mood: SceneMood;
  chord: number[];
}
export interface MusicHit {
  at: number;
  kind: "boom" | "crit" | "fumble";
}
export interface MusicPlan {
  seconds: number;
  segments: MusicSegment[];
  hits: MusicHit[];
}

/** What the soundtrack plays, in seconds. Deterministic: the same script always sounds the same. */
export function musicPlan(script: Pick<EpisodeScript, "scenes">): MusicPlan {
  const starts = sceneStarts(script);
  const segments: MusicSegment[] = [];
  const hits: MusicHit[] = [];
  script.scenes.forEach((scene, i) => {
    const from = starts[i] / FPS;
    const length = scene.seconds * FPS;
    const shift = PROGRESSION[i % PROGRESSION.length];
    segments.push({ from, to: from + scene.seconds, mood: scene.mood, chord: MOOD_VOICING[scene.mood].chord.map((n) => n + shift) });
    if (scene.kind === "title") hits.push({ at: from + 12 / FPS, kind: "boom" });
    if (scene.kind === "scene" && scene.sfx.trim()) hits.push({ at: from + sfxStart(length) / FPS, kind: "boom" });
    if (scene.kind === "roll" && scene.roll) hits.push({ at: from + ROLL_REVEAL / FPS, kind: scene.roll.natural === 20 ? "crit" : scene.roll.natural === 1 ? "fumble" : "boom" });
  });
  return { seconds: starts.length ? starts.at(-1)! / FPS + script.scenes.at(-1)!.seconds : 1, segments, hits };
}

/** A key that changes only when the music would: timing, moods and hits (not the text). */
export const musicKey = (script: Pick<EpisodeScript, "scenes">) =>
  script.scenes.map((s) => `${s.kind}:${s.seconds}:${s.mood}:${s.sfx.trim() ? 1 : 0}:${s.roll?.natural ?? ""}`).join("|");
