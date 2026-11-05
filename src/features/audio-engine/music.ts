"use client";

/**
 * Generative music themes synthesised with Web Audio, and playback of the
 * GM's uploaded tracks. A theme is written bar by bar: chords, arpeggios,
 * drums and melodies drawn from a seeded random generator, so everyone at the
 * table hears the same bars when they join at the same point in time.
 * Scheduling follows the usual look-ahead clock (a short timer queues the
 * next notes on the audio clock).
 */
import { noise } from "./sfx";
import type { ThemeId } from "./catalog";

export interface MusicVoice {
  gain: GainNode;
  setVolume(volume: number): void;
  setLoop(loop: boolean): void;
  stop(fade?: number): void;
}

/** Moves a gain to a new level from wherever it is now (a pending fade-in included). */
export function glide(c: AudioContext, gain: GainNode, to: number, time = 0.3) {
  const now = c.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
  gain.gain.setTargetAtTime(Math.max(0.0001, to), now, time);
}


const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Small deterministic generator (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Instruments (each skips notes already in the past) ---------- */

type Out = { c: AudioContext; out: AudioNode };

function env(c: AudioContext, at: number, attack: number, peak: number, release: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  return g;
}

function pluck({ c, out }: Out, at: number, midi: number, dur: number, gain: number) {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = hz(midi);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(hz(midi) * 6, at);
  lp.frequency.exponentialRampToValueAtTime(hz(midi) * 1.5, at + dur);
  const g = env(c, at, 0.005, gain, dur);
  osc.connect(lp).connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.1);
}

function pad({ c, out }: Out, at: number, notes: number[], dur: number, gain: number, bright = 900) {
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = bright;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + Math.min(1.2, dur / 3));
  g.gain.setValueAtTime(gain, at + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.6);
  lp.connect(g).connect(out);
  for (const n of notes) {
    for (const detune of [-7, 7]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz(n);
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(start);
      osc.stop(at + dur + 0.7);
    }
  }
}

function bell({ c, out }: Out, at: number, midi: number, gain: number) {
  if (at < c.currentTime) return;
  for (const [ratio, level, decay] of [[1, 1, 2.2], [2.76, 0.35, 1.1], [5.4, 0.12, 0.5]] as const) {
    const osc = c.createOscillator();
    osc.frequency.value = hz(midi) * ratio;
    const g = env(c, at, 0.004, gain * level, decay);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.1);
  }
}

function bass({ c, out }: Out, at: number, midi: number, dur: number, gain: number) {
  if (at < c.currentTime) return;
  for (const [type, level] of [["triangle", 1], ["sine", 0.8]] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = hz(midi) / (type === "sine" ? 2 : 1);
    const g = env(c, at, 0.01, gain * level, dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }
}

function drum({ c, out }: Out, at: number, from: number, to: number, decay: number, gain: number) {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.6);
  const g = env(c, at, 0.003, gain, decay);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.1);
}

function noiseHit({ c, out }: Out, at: number, freq: number, type: BiquadFilterType, decay: number, gain: number) {
  if (at < c.currentTime) return;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = env(c, at, 0.002, gain, decay);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.5, decay + 0.05);
}

const kick = (o: Out, at: number, gain = 0.5) => drum(o, at, 130, 45, 0.35, gain);
const tom = (o: Out, at: number, f: number, gain = 0.3) => drum(o, at, f, f * 0.55, 0.3, gain);
const snare = (o: Out, at: number, gain = 0.25) => {
  noiseHit(o, at, 1800, "bandpass", 0.16, gain);
  drum(o, at, 220, 160, 0.1, gain * 0.5);
};
const hat = (o: Out, at: number, gain = 0.05) => noiseHit(o, at, 7500, "highpass", 0.04, gain);

function brass({ c, out }: Out, at: number, notes: number[], dur: number, gain: number) {
  if (at < c.currentTime) return;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(400, at);
  lp.frequency.exponentialRampToValueAtTime(2600, at + 0.08);
  lp.frequency.exponentialRampToValueAtTime(900, at + dur);
  const g = env(c, at, 0.03, gain, dur);
  lp.connect(g).connect(out);
  for (const n of notes) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz(n);
    osc.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }
}

/* ---------- Themes ---------- */

interface Theme {
  bpm: number;
  beats: number;
  /** Length when not looping (bars). */
  bars: number;
  bar(o: Out, b: number, t: number, beat: number, rnd: () => number): void;
}

const pick = <T,>(rnd: () => number, list: readonly T[]) => list[Math.floor(rnd() * list.length)];

const THEMES: Record<ThemeId, Theme> = {
  explore: {
    bpm: 76,
    beats: 4,
    bars: 16,
    bar(o, b, t, beat, rnd) {
      const chords = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]];
      const chord = chords[b % 4];
      pad(o, t, chord.map((n) => n + 12), beat * 4, 0.035, 1100);
      bass(o, t, chord[0] - 12, beat * 1.8, 0.12);
      bass(o, t + beat * 2, chord[0] - 12, beat * 1.8, 0.09);
      const tones = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
      for (let i = 0; i < 8; i++) if (i === 0 || rnd() > 0.2) pluck(o, t + i * beat * 0.5, pick(rnd, tones), beat * 1.5, 0.07);
    },
  },
  tension: {
    bpm: 64,
    beats: 4,
    bars: 16,
    bar(o, b, t, beat, rnd) {
      pad(o, t, [33, 45], beat * 4, 0.05, 500);
      for (let i = 0; i < 4; i += 2) {
        kick(o, t + i * beat, 0.45);
        kick(o, t + i * beat + beat * 0.32, 0.25);
      }
      if (b % 2 === 1) pad(o, t + beat, [57, 58], beat * 3, 0.03, 1400);
      if (b % 4 === 3) for (let i = 0; i < 16; i++) pluck(o, t + i * beat * 0.25, 76 + (rnd() > 0.7 ? 1 : 0), 0.15, 0.025);
    },
  },
  combat: {
    bpm: 138,
    beats: 4,
    bars: 32,
    bar(o, b, t, beat, rnd) {
      const roots = [57, 53, 55, 52];
      const root = roots[b % 4];
      const minor = b % 4 === 0 || b % 4 === 3;
      kick(o, t, 0.55);
      kick(o, t + beat * 2, 0.5);
      if (rnd() > 0.5) kick(o, t + beat * 2.5, 0.35);
      snare(o, t + beat);
      snare(o, t + beat * 3);
      for (let i = 0; i < 8; i++) hat(o, t + i * beat * 0.5, i % 2 ? 0.03 : 0.05);
      const riff = [0, 0, 12, 0, 0, 10, 12, 7];
      riff.forEach((step, i) => bass(o, t + i * beat * 0.5, root - 24 + step, beat * 0.45, 0.13));
      const chord = [root, root + (minor ? 3 : 4), root + 7];
      brass(o, t, chord, beat * 0.9, 0.06);
      brass(o, t + beat * 2.5, chord, beat * 0.6, 0.045);
      if (b % 8 === 7) [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 3.75].forEach((x, i) => tom(o, t + x * beat, 220 - i * 12, 0.3));
    },
  },
  mystery: {
    bpm: 58,
    beats: 4,
    bars: 16,
    bar(o, b, t, beat, rnd) {
      const chords = [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]];
      pad(o, t, chords[b % 4], beat * 4, 0.04, 700);
      const scale = [76, 79, 81, 83, 86, 88];
      const count = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < count; i++) bell(o, t + Math.floor(rnd() * 8) * beat * 0.5, pick(rnd, scale), 0.05);
    },
  },
  tavern: {
    bpm: 120,
    beats: 3,
    bars: 32,
    bar(o, b, t, beat, rnd) {
      const chords = [[55, 59, 62], [48, 52, 55], [50, 54, 57], [55, 59, 62]];
      const chord = chords[b % 4];
      bass(o, t, chord[0] - 12, beat * 0.8, 0.13);
      pluck(o, t + beat, chord[1], beat * 0.6, 0.05);
      pluck(o, t + beat, chord[2], beat * 0.6, 0.05);
      pluck(o, t + beat * 2, chord[1], beat * 0.6, 0.05);
      pluck(o, t + beat * 2, chord[2], beat * 0.6, 0.05);
      for (let i = 0; i < 3; i++) hat(o, t + i * beat, 0.035);
      // A dancing melody: a walk through G major, on the chord tones at the bar's start.
      const scale = [67, 69, 71, 72, 74, 76, 78, 79];
      let step = scale.indexOf(chord[0] + 12) >= 0 ? scale.indexOf(chord[0] + 12) : 0;
      for (let i = 0; i < 6; i++) {
        if (i > 0) step = Math.max(0, Math.min(scale.length - 1, step + (rnd() > 0.5 ? 1 : -1) * (rnd() > 0.8 ? 2 : 1)));
        pluck(o, t + i * beat * 0.5, scale[step], beat * 0.45, 0.08);
      }
    },
  },
  victory: {
    bpm: 96,
    beats: 4,
    bars: 8,
    bar(o, b, t, beat) {
      if (b % 8 === 0) {
        [60, 64, 67, 72].forEach((n, i) => brass(o, t + i * beat, [n, n - 12], beat * 0.9, 0.08));
        return;
      }
      const chords = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]];
      const chord = chords[(b % 8) - 1] ?? chords[0];
      pad(o, t, chord, beat * 4, 0.04, 1600);
      brass(o, t, chord, beat * 1.2, 0.06);
      bass(o, t, chord[0] - 24, beat * 2, 0.13);
      if (b % 8 === 7) for (let i = 0; i < 16; i++) tom(o, t + i * beat * 0.25, 90, 0.12 + i * 0.012);
    },
  },
};

/** Length of a theme played once (seconds). */
export const themeSeconds = (id: ThemeId) => (THEMES[id].bars * THEMES[id].beats * 60) / THEMES[id].bpm;

/** Plays a theme from `offset` seconds in (joining mid-way like everyone else). */
export function startTheme(c: AudioContext, bus: AudioNode, id: ThemeId, offset: number, volume: number, loop: boolean): MusicVoice {
  const theme = THEMES[id];
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 1.5);
  out.connect(bus);
  const o = { c, out };
  const beat = 60 / theme.bpm;
  const barLength = beat * theme.beats;
  const t0 = c.currentTime - Math.max(0, offset);
  let next = Math.max(0, Math.floor(offset / barLength));
  let looping = loop;
  const salt = [...id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7);

  const tick = () => {
    // A hidden tab runs timers about once a second: look further ahead then.
    const ahead = typeof document !== "undefined" && document.hidden ? 2.5 : 0.35;
    while (t0 + next * barLength < c.currentTime + ahead) {
      if (!looping && next >= theme.bars) return clearInterval(timer);
      theme.bar(o, next, t0 + next * barLength, beat, seeded(salt + next * 7919));
      next += 1;
    }
  };
  const timer = setInterval(tick, 60);
  tick();

  return {
    gain: out,
    setVolume(v) {
      glide(c, out, v);
    },
    setLoop(v) {
      looping = v;
    },
    stop(fade = 1.5) {
      clearInterval(timer);
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), c.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade);
      setTimeout(() => out.disconnect(), fade * 1000 + 200);
    },
  };
}

/** Plays an uploaded track from `offset` seconds in. */
export function startTrack(c: AudioContext, bus: AudioNode, buffer: AudioBuffer, offset: number, volume: number, loop: boolean): MusicVoice | null {
  if (!loop && offset >= buffer.duration) return null;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 1);
  src.connect(out).connect(bus);
  src.start(0, loop ? offset % buffer.duration : offset);
  return {
    gain: out,
    setVolume(v) {
      glide(c, out, v);
    },
    setLoop(v) {
      src.loop = v;
    },
    stop(fade = 1.2) {
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), c.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade);
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          // Already over.
        }
        out.disconnect();
      }, fade * 1000 + 100);
    },
  };
}
