import { describe, expect, it } from "vitest";
import type { EpisodeScene, EpisodeScript } from "@/types/chronicle";
import { FPS, MUSIC_DUCKED, MUSIC_LEVEL, NARRATION_START, musicKey, musicPlan, musicVolume, sceneStarts, speechSeconds, speechWindows, voiceFits } from "./audio-mix";
import { floatToWav, isWav, pcmToWav, wavSeconds } from "./wav";

const scene = (id: string, extra: Partial<EpisodeScene> = {}): EpisodeScene => ({
  id,
  kind: "scene",
  narration: "",
  dialogue: [],
  imagePrompt: "",
  cast: [],
  camera: "still",
  mood: "calm",
  sfx: "",
  seconds: 5,
  roll: null,
  ...extra,
});
const script = (scenes: EpisodeScene[]): EpisodeScript => ({ title: "T", logline: "", visualStyle: "", characters: [], scenes });

describe("episode timing", () => {
  it("starts each scene after the previous one", () => {
    expect(sceneStarts(script([scene("a", { seconds: 4 }), scene("b", { seconds: 6 }), scene("c")]))).toEqual([0, 4 * FPS, 10 * FPS]);
  });

  it("estimates how long a caption takes to read aloud", () => {
    expect(speechSeconds("")).toBe(0);
    expect(speechSeconds("um dois três quatro cinco seis sete oito nove dez onze doze treze")).toBeGreaterThan(4);
  });
});

describe("narration", () => {
  it("uses a recorded clip only while it reads the current caption", () => {
    const s = scene("a", { narration: "A ponte caiu." });
    expect(voiceFits(s, { text: "A ponte caiu.", seconds: 2 })).toBe(true);
    expect(voiceFits(s, { text: "A ponte ruiu.", seconds: 2 })).toBe(false);
    expect(voiceFits(scene("b"), { text: "", seconds: 1 })).toBe(false);
    expect(voiceFits(s, undefined)).toBe(false);
  });

  it("marks the narrator (recorded length when it fits) and the balloons as speech, inside each scene", () => {
    const s = script([scene("a", { narration: "Era uma vez", seconds: 6, dialogue: [{ speaker: "Kael", line: "Vamos!" }] }), scene("b", { kind: "end", narration: "Fim.", dialogue: [{ speaker: "X", line: "não lido" }] })]);
    const windows = speechWindows(s, { a: { text: "Era uma vez", seconds: 3 } });
    expect(windows[0]).toEqual({ from: NARRATION_START, to: NARRATION_START + 3 * FPS });
    // The balloon of scene a, then only the narration of the end card (its balloons aren't shown).
    expect(windows).toHaveLength(3);
    expect(windows.every((w) => w.to <= 11 * FPS && w.from < w.to)).toBe(true);
    expect(windows[2].from).toBe(6 * FPS + NARRATION_START);
  });
});

describe("music level", () => {
  const windows = [{ from: 100, to: 200 }];
  it("ducks under speech, with ramps, and comes back", () => {
    expect(musicVolume(50, 1000, windows)).toBeCloseTo(MUSIC_LEVEL);
    expect(musicVolume(150, 1000, windows)).toBeCloseTo(MUSIC_DUCKED);
    const ramp = musicVolume(96, 1000, windows);
    expect(ramp).toBeLessThan(MUSIC_LEVEL);
    expect(ramp).toBeGreaterThan(MUSIC_DUCKED);
    expect(musicVolume(260, 1000, windows)).toBeCloseTo(MUSIC_LEVEL);
  });

  it("fades in at the start and out at the end", () => {
    expect(musicVolume(0, 1000, [])).toBe(0);
    expect(musicVolume(1000, 1000, [])).toBe(0);
    expect(musicVolume(980, 1000, [])).toBeLessThan(MUSIC_LEVEL);
  });
});

describe("soundtrack plan", () => {
  it("follows the scenes' moods and hits the big moments", () => {
    const plan = musicPlan(
      script([
        scene("t", { kind: "title", mood: "dark" }),
        scene("s", { mood: "epic", sfx: "BOOM!" }),
        scene("r", { kind: "roll", mood: "tense", roll: { label: "Ataque", total: 25, natural: 20 } }),
        scene("f", { kind: "roll", mood: "funny", roll: { label: "Salto", total: 3, natural: 1 } }),
      ]),
    );
    expect(plan.seconds).toBe(20);
    expect(plan.segments.map((s) => s.mood)).toEqual(["dark", "epic", "tense", "funny"]);
    expect(plan.segments[1]).toMatchObject({ from: 5, to: 10 });
    expect(plan.hits.map((h) => h.kind)).toEqual(["boom", "boom", "crit", "fumble"]);
    expect(plan.hits.every((h, i) => h.at >= plan.segments[i].from && h.at < plan.segments[i].to)).toBe(true);
  });

  it("changes key only when the music would change", () => {
    const a = script([scene("a", { narration: "um" })]);
    expect(musicKey({ scenes: [{ ...a.scenes[0], narration: "outro texto" }] })).toBe(musicKey(a));
    expect(musicKey({ scenes: [{ ...a.scenes[0], mood: "dark" }] })).not.toBe(musicKey(a));
    expect(musicKey({ scenes: [{ ...a.scenes[0], seconds: 7 }] })).not.toBe(musicKey(a));
  });
});

describe("wav", () => {
  it("wraps PCM and measures it", () => {
    const wav = pcmToWav(new Uint8Array(48_000), 24_000);
    expect(isWav(wav)).toBe(true);
    expect(wavSeconds(wav)).toBeCloseTo(1);
    expect(wavSeconds(floatToWav(new Float32Array(12_000), 24_000))).toBeCloseTo(0.5);
  });

  it("finds the data chunk after other chunks, and rejects what isn't WAV", () => {
    const wav = pcmToWav(new Uint8Array(24_000), 24_000);
    const list = new Uint8Array([..."LIST"].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4]));
    const withList = new Uint8Array([...wav.subarray(0, 36), ...list, ...wav.subarray(36)]);
    expect(wavSeconds(withList)).toBeCloseTo(0.5);
    expect(wavSeconds(new Uint8Array([1, 2, 3]))).toBe(0);
  });
});
