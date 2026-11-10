"use client";

/**
 * Generative music themes synthesised with Web Audio, and playback of the
 * GM's uploaded tracks. A theme is written bar by bar: chords, arpeggios,
 * drums and melodies drawn from a seeded random generator, so everyone at the
 * table hears the same bars when they join at the same point in time.
 * Scheduling follows the usual look-ahead clock (a short timer queues the
 * next notes on the audio clock). Each theme plays through its own hall
 * reverb, so the synthesised instruments sit in a shared space.
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

/* ---------- Space ---------- */

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A stereo hall impulse (decaying noise), made once per context. */
export function hallImpulse(c: BaseAudioContext, seconds = 2.8): AudioBuffer {
  let buffer = impulses.get(c);
  if (buffer) return buffer;
  const length = Math.floor(c.sampleRate * seconds);
  buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const rnd = seeded(97 + ch);
    for (let i = 0; i < length; i++) data[i] = (rnd() * 2 - 1) * (1 - i / length) ** 3;
  }
  impulses.set(c, buffer);
  return buffer;
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

/** Sends a voice to a spot in the stereo field. */
function place(o: Out, pan: number): AudioNode {
  if (!pan) return o.out;
  const p = o.c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(o.out);
  return p;
}

/** Plucked string (harp, lute, guitar): bright attack that darkens as it rings. */
function pluck(o: Out, at: number, midi: number, dur: number, gain: number, pan = 0, tone = 6) {
  const { c } = o;
  if (at < c.currentTime) return;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(hz(midi) * tone, at);
  lp.frequency.exponentialRampToValueAtTime(hz(midi) * 1.3, at + dur);
  const g = env(c, at, 0.004, gain, dur);
  lp.connect(g).connect(place(o, pan));
  for (const [type, level, detune] of [["triangle", 1, 0], ["sawtooth", 0.25, 4]] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = hz(midi);
    osc.detune.value = detune;
    const lv = c.createGain();
    lv.gain.value = level;
    osc.connect(lv).connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }
}

/** Sustained chord: strings (bright) or a soft pad, with a slow swell and a gentle vibrato. */
function pad(o: Out, at: number, notes: number[], dur: number, gain: number, bright = 900) {
  const { c, out } = o;
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
  const vib = c.createOscillator();
  vib.frequency.value = 4.8;
  const depth = c.createGain();
  depth.gain.value = 6;
  vib.connect(depth);
  vib.start(start);
  vib.stop(at + dur + 0.7);
  for (const n of notes) {
    for (const detune of [-7, 7]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz(n);
      osc.detune.value = detune;
      depth.connect(osc.detune);
      osc.connect(lp);
      osc.start(start);
      osc.stop(at + dur + 0.7);
    }
  }
}

/** Voices singing "ah": sawtooth through two vowel formants. */
function choir(o: Out, at: number, notes: number[], dur: number, gain: number) {
  const { c, out } = o;
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + Math.min(0.9, dur / 3));
  g.gain.setValueAtTime(gain, at + dur * 0.85);
  g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.8);
  g.connect(out);
  const formants = [
    [730, 1, 6],
    [1090, 0.5, 8],
    [2440, 0.18, 10],
  ].map(([f, level, q]) => {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = q;
    const lv = c.createGain();
    lv.gain.value = level * 3;
    bp.connect(lv).connect(g);
    return bp;
  });
  const vib = c.createOscillator();
  vib.frequency.value = 5.2;
  const depth = c.createGain();
  depth.gain.value = 9;
  vib.connect(depth);
  vib.start(start);
  vib.stop(at + dur + 0.9);
  for (const n of notes) {
    for (const detune of [-10, 0, 11]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz(n);
      osc.detune.value = detune;
      depth.connect(osc.detune);
      for (const f of formants) osc.connect(f);
      osc.start(start);
      osc.stop(at + dur + 0.9);
    }
  }
}

/** Church organ: a few sine partials, steady. */
function organ(o: Out, at: number, notes: number[], dur: number, gain: number) {
  const { c, out } = o;
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.15);
  g.gain.setValueAtTime(gain, at + dur);
  g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.5);
  g.connect(out);
  for (const n of notes) {
    for (const [ratio, level] of [[1, 1], [2, 0.5], [3, 0.25], [4, 0.18]]) {
      const osc = c.createOscillator();
      osc.frequency.value = hz(n) * ratio;
      const lv = c.createGain();
      lv.gain.value = level / notes.length;
      osc.connect(lv).connect(g);
      osc.start(start);
      osc.stop(at + dur + 0.6);
    }
  }
}

/** Breathy wooden flute with a vibrato that comes in late. */
function flute(o: Out, at: number, midi: number, dur: number, gain: number, pan = 0) {
  const { c } = o;
  if (at < c.currentTime) return;
  const dest = place(o, pan);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.07);
  g.gain.setValueAtTime(gain, at + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.15);
  g.connect(dest);
  const osc = c.createOscillator();
  osc.frequency.value = hz(midi);
  const vib = c.createOscillator();
  vib.frequency.value = 5.5;
  const depth = c.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(hz(midi) * 0.006, at + Math.min(0.4, dur));
  vib.connect(depth).connect(osc.frequency);
  const overtone = c.createOscillator();
  overtone.frequency.value = hz(midi) * 2;
  const ov = c.createGain();
  ov.gain.value = 0.12;
  osc.connect(g);
  overtone.connect(ov).connect(g);
  for (const n of [osc, overtone, vib]) {
    n.start(at);
    n.stop(at + dur + 0.2);
  }
  // A little breath on the attack.
  const breath = c.createBufferSource();
  breath.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = hz(midi) * 2;
  bp.Q.value = 2;
  const bg = env(c, at, 0.02, gain * 0.25, 0.12);
  breath.connect(bp).connect(bg).connect(dest);
  breath.start(at, Math.random() * 0.5, 0.2);
}

/** Squeezebox (shanties): two detuned square reeds. */
function reed(o: Out, at: number, notes: number[], dur: number, gain: number) {
  const { c, out } = o;
  if (at < c.currentTime) return;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.03);
  g.gain.setValueAtTime(gain, at + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05);
  lp.connect(g).connect(out);
  for (const n of notes) {
    for (const detune of [-6, 6]) {
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.value = hz(n);
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(at);
      osc.stop(at + dur + 0.1);
    }
  }
}

function bell(o: Out, at: number, midi: number, gain: number, pan = 0) {
  const { c } = o;
  if (at < c.currentTime) return;
  const dest = place(o, pan);
  for (const [ratio, level, decay] of [[1, 1, 2.2], [2.76, 0.35, 1.1], [5.4, 0.12, 0.5]] as const) {
    const osc = c.createOscillator();
    osc.frequency.value = hz(midi) * ratio;
    const g = env(c, at, 0.004, gain * level, decay);
    osc.connect(g).connect(dest);
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
/** Orchestral kettle drum: low boom with a skin of noise. */
const timpani = (o: Out, at: number, midi: number, gain = 0.45) => {
  drum(o, at, hz(midi) * 1.5, hz(midi), 1.1, gain);
  noiseHit(o, at, 300, "lowpass", 0.25, gain * 0.4);
};
/** Cymbal swell or crash. */
const cymbal = (o: Out, at: number, gain = 0.08, decay = 1.6) => noiseHit(o, at, 5500, "highpass", decay, gain);
/** Hand drum: deep "doum" in the middle, sharp "tek" on the rim. */
const doum = (o: Out, at: number, gain = 0.35) => drum(o, at, 110, 70, 0.28, gain);
const tek = (o: Out, at: number, gain = 0.12) => noiseHit(o, at, 3200, "bandpass", 0.05, gain);

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

/** A thin glide that rises out of nowhere (horror stingers). */
function wail({ c, out }: Out, at: number, from: number, to: number, dur: number, gain: number) {
  if (at < c.currentTime) return;
  for (const detune of [0, 23]) {
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(hz(from), at);
    osc.frequency.exponentialRampToValueAtTime(hz(to), at + dur);
    osc.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

/* ---------- Themes ---------- */

interface Theme {
  bpm: number;
  beats: number;
  /** Length when not looping (bars). */
  bars: number;
  /** How much of the hall reverb it gets (0..1). */
  space: number;
  bar(o: Out, b: number, t: number, beat: number, rnd: () => number): void;
}

const pick = <T,>(rnd: () => number, list: readonly T[]) => list[Math.floor(rnd() * list.length)];

/** A melody that walks a scale by small steps, starting on `from`. */
function walk(rnd: () => number, scale: readonly number[], from: number, count: number, leap = 0.2): number[] {
  let i = Math.max(0, scale.indexOf(from));
  return Array.from({ length: count }, (_, k) => {
    if (k > 0) i = Math.max(0, Math.min(scale.length - 1, i + (rnd() > 0.5 ? 1 : -1) * (rnd() < leap ? 2 : 1)));
    return scale[i];
  });
}

const THEMES: Record<ThemeId, Theme> = {
  explore: {
    bpm: 76,
    beats: 4,
    bars: 16,
    space: 0.35,
    bar(o, b, t, beat, rnd) {
      const chords = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]];
      const chord = chords[b % 4];
      pad(o, t, chord.map((n) => n + 12), beat * 4, 0.035, 1100);
      bass(o, t, chord[0] - 12, beat * 1.8, 0.12);
      bass(o, t + beat * 2, chord[0] - 12, beat * 1.8, 0.09);
      const tones = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
      for (let i = 0; i < 8; i++) if (i === 0 || rnd() > 0.2) pluck(o, t + i * beat * 0.5, pick(rnd, tones), beat * 1.5, 0.07, i % 2 ? 0.3 : -0.3);
      // Every other phrase a flute answers the harp.
      if (b % 8 >= 4) walk(rnd, [74, 76, 77, 79, 81, 82, 84], chord[0] + 24, 3).forEach((n, i) => flute(o, t + beat * (i * 1.3), n, beat * 1.2, 0.045, 0.2));
    },
  },
  camp: {
    bpm: 84,
    beats: 3,
    bars: 24,
    space: 0.25,
    bar(o, b, t, beat, rnd) {
      // D – A – Bm – G, fingerpicked in sixes.
      const chords = [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]];
      const [root, fifth, oct, third] = chords[b % 4];
      bass(o, t, root - 12, beat * 2.5, 0.09);
      [root, fifth, oct, third, oct, fifth].forEach((n, i) => pluck(o, t + i * beat * 0.5, n, beat * 1.4, i === 0 ? 0.08 : 0.055, -0.25 + i * 0.1, 3.5));
      if (b % 4 === 2 && rnd() > 0.3) walk(rnd, [74, 76, 78, 79, 81, 83], 78, 4).forEach((n, i) => flute(o, t + i * beat * 0.75, n, beat * 0.7, 0.035, 0.3));
    },
  },
  fey: {
    bpm: 72,
    beats: 4,
    bars: 16,
    space: 0.6,
    bar(o, b, t, beat, rnd) {
      // F Lydian: the raised fourth makes it float.
      const chords = [[53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64], [53, 57, 60, 65]];
      const chord = chords[b % 4];
      pad(o, t, chord, beat * 4, 0.025, 1600);
      bass(o, t, chord[0] - 12, beat * 3.5, 0.07);
      const sparkle = [77, 79, 81, 83, 84, 86, 88, 89, 91];
      for (let i = 0; i < 4; i++) if (rnd() > 0.35) bell(o, t + Math.floor(rnd() * 16) * beat * 0.25, pick(rnd, sparkle), 0.03, rnd() * 1.6 - 0.8);
      const tune = walk(rnd, [65, 67, 69, 71, 72, 74, 76, 77, 79], chord[2] + 12, 4, 0.3);
      tune.forEach((n, i) => flute(o, t + i * beat, n, beat * 0.9, 0.05));
    },
  },
  sacred: {
    bpm: 50,
    beats: 4,
    bars: 12,
    space: 0.8,
    bar(o, b, t, beat) {
      // C – Am – F – G – C – F – G – C: hymn-like, ending home.
      const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]];
      const chord = chords[b % 8];
      choir(o, t, chord, beat * 4, 0.05);
      organ(o, t, [chord[0] - 24, chord[0] - 12], beat * 4, 0.05);
      if (b % 4 === 0) bell(o, t, chord[0] + 12, 0.05);
    },
  },
  sorrow: {
    bpm: 60,
    beats: 4,
    bars: 16,
    space: 0.55,
    bar(o, b, t, beat, rnd) {
      // D minor: Dm – B♭ – Gm – A.
      const chords = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
      const chord = chords[b % 4];
      pad(o, t, chord.map((n) => n + 12), beat * 4, 0.04, 1300);
      bass(o, t, chord[0] - 12, beat * 4, 0.08);
      // A descending lament on strings, two long notes a bar.
      const line = walk(rnd, [74, 72, 70, 69, 67, 65, 64, 62], chord[2] + 12, 2, 0);
      line.forEach((n, i) => pad(o, t + i * beat * 2, [n], beat * 2, 0.03, 2200));
    },
  },
  journey: {
    bpm: 108,
    beats: 4,
    bars: 16,
    space: 0.3,
    bar(o, b, t, beat, rnd) {
      // C – G – Am – F, marching.
      const chords = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
      const chord = chords[b % 4];
      kick(o, t, 0.4);
      kick(o, t + beat * 2, 0.35);
      snare(o, t + beat, 0.16);
      snare(o, t + beat * 3, 0.16);
      snare(o, t + beat * 3.5, 0.08);
      for (let i = 0; i < 8; i++) pluck(o, t + i * beat * 0.5, chord[i % 3] + 12, beat * 0.45, 0.05, i % 2 ? 0.35 : -0.35, 4);
      bass(o, t, chord[0] - 12, beat * 0.9, 0.12);
      bass(o, t + beat * 2, chord[0] - 12, beat * 0.9, 0.1);
      pad(o, t, chord.map((n) => n + 12), beat * 4, 0.025, 1500);
      // The heroic call every four bars, answered by strings.
      if (b % 4 === 0) [0, 7, 12, 11, 12].forEach((step, i) => brass(o, t + [0, 0.5, 1, 2, 2.5][i] * beat, [chord[0] + 12 + step], beat * (i === 4 ? 1.4 : 0.45), 0.06));
      else if (rnd() > 0.4) walk(rnd, [72, 74, 76, 77, 79, 81, 83, 84], 79, 4).forEach((n, i) => flute(o, t + i * beat, n, beat * 0.9, 0.035));
    },
  },
  sea: {
    bpm: 200,
    beats: 6,
    bars: 24,
    space: 0.2,
    bar(o, b, t, beat, rnd) {
      // A shanty in D minor, counted in sixes: Dm – C – Dm – A.
      const chords = [[50, 53, 57], [48, 52, 55], [50, 53, 57], [45, 49, 52]];
      const chord = chords[b % 4];
      bass(o, t, chord[0] - 12, beat * 2.5, 0.12);
      bass(o, t + beat * 3, chord[0] - 5, beat * 2.5, 0.09);
      doum(o, t, 0.3);
      doum(o, t + beat * 3, 0.22);
      reed(o, t + beat, chord.map((n) => n + 12), beat * 1.6, 0.025);
      reed(o, t + beat * 4, chord.map((n) => n + 12), beat * 1.6, 0.025);
      const tune = walk(rnd, [62, 64, 65, 67, 69, 70, 72, 74], chord[0] + 12, 4, 0.25);
      [0, 2, 3, 5].forEach((x, i) => reed(o, t + x * beat, [tune[i] + 12], beat * (i === 3 ? 1 : 1.8), 0.03));
    },
  },
  desert: {
    bpm: 92,
    beats: 4,
    bars: 16,
    space: 0.3,
    bar(o, b, t, beat, rnd) {
      // E Phrygian dominant over a drone.
      if (b % 2 === 0) pad(o, t, [40, 47], beat * 8, 0.035, 700);
      doum(o, t, 0.35);
      tek(o, t + beat, 0.12);
      tek(o, t + beat * 1.5, 0.08);
      doum(o, t + beat * 2, 0.28);
      tek(o, t + beat * 3, 0.12);
      if (rnd() > 0.5) tek(o, t + beat * 3.5, 0.08);
      const scale = [64, 65, 68, 69, 71, 72, 74, 76, 77];
      const tune = walk(rnd, scale, b % 4 === 3 ? 71 : 64, 7, 0.15);
      tune.forEach((n, i) => pluck(o, t + i * beat * 0.5, n, beat * 0.6, 0.06, 0.2, 5));
      if (b % 4 === 3) flute(o, t + beat * 3.5, 76, beat * 0.5, 0.04);
    },
  },
  tavern: {
    bpm: 120,
    beats: 3,
    bars: 32,
    space: 0.2,
    bar(o, b, t, beat, rnd) {
      const chords = [[55, 59, 62], [48, 52, 55], [50, 54, 57], [55, 59, 62]];
      const chord = chords[b % 4];
      bass(o, t, chord[0] - 12, beat * 0.8, 0.13);
      pluck(o, t + beat, chord[1], beat * 0.6, 0.05, -0.3);
      pluck(o, t + beat, chord[2], beat * 0.6, 0.05, -0.3);
      pluck(o, t + beat * 2, chord[1], beat * 0.6, 0.05, -0.3);
      pluck(o, t + beat * 2, chord[2], beat * 0.6, 0.05, -0.3);
      for (let i = 0; i < 3; i++) hat(o, t + i * beat, 0.035);
      if (b % 2 === 0) doum(o, t, 0.2);
      // A dancing melody: a walk through G major, on the chord tones at the bar's start.
      const scale = [67, 69, 71, 72, 74, 76, 78, 79];
      const melody = walk(rnd, scale, chord[0] + 12, 6);
      melody.forEach((n, i) => (b % 8 < 4 ? pluck(o, t + i * beat * 0.5, n, beat * 0.45, 0.08, 0.25) : flute(o, t + i * beat * 0.5, n + 12, beat * 0.45, 0.04, 0.25)));
    },
  },
  mystery: {
    bpm: 58,
    beats: 4,
    bars: 16,
    space: 0.55,
    bar(o, b, t, beat, rnd) {
      const chords = [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]];
      pad(o, t, chords[b % 4], beat * 4, 0.04, 700);
      const scale = [76, 79, 81, 83, 86, 88];
      const count = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < count; i++) bell(o, t + Math.floor(rnd() * 8) * beat * 0.5, pick(rnd, scale), 0.05, rnd() * 1.2 - 0.6);
    },
  },
  tension: {
    bpm: 64,
    beats: 4,
    bars: 16,
    space: 0.4,
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
  dungeon: {
    bpm: 50,
    beats: 4,
    bars: 16,
    space: 0.85,
    bar(o, b, t, beat, rnd) {
      if (b % 2 === 0) pad(o, t, [33, 40], beat * 8, 0.05, 380);
      // Distant voices, minor and low.
      const chords = [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 56, 59]];
      if (b % 2 === 1) choir(o, t, chords[(b >> 1) % 4], beat * 4, 0.022);
      if (rnd() > 0.4) bell(o, t + Math.floor(rnd() * 8) * beat * 0.5, pick(rnd, [45, 48, 52]), 0.05, rnd() * 1.4 - 0.7);
      // A slow heartbeat of a drum, now and then.
      if (b % 4 === 0) {
        timpani(o, t, 33, 0.25);
        timpani(o, t + beat * 0.6, 33, 0.15);
      }
    },
  },
  horror: {
    bpm: 60,
    beats: 4,
    bars: 16,
    space: 0.7,
    bar(o, b, t, beat, rnd) {
      // A cluster that never resolves, and long silences.
      if (b % 2 === 0) pad(o, t, [48, 49, 54], beat * 8, 0.035, 600);
      if (b % 4 === 1) {
        kick(o, t, 0.35);
        kick(o, t + beat * 0.35, 0.22);
      }
      // A music box out of tune: tritones.
      if (b % 4 === 2) [84, 78, 83, 77].forEach((n, i) => bell(o, t + i * beat * 0.75, n, 0.035, 0.5));
      if (rnd() > 0.65) wail(o, t + beat * Math.floor(rnd() * 3), 79 + Math.floor(rnd() * 5), 86 + Math.floor(rnd() * 4), beat * 2, 0.012);
      if (b % 8 === 7) cymbal(o, t + beat * 3, 0.06, 0.9);
    },
  },
  combat: {
    bpm: 138,
    beats: 4,
    bars: 32,
    space: 0.25,
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
      if (b % 8 === 0) cymbal(o, t, 0.07);
    },
  },
  boss: {
    bpm: 150,
    beats: 4,
    bars: 32,
    space: 0.4,
    bar(o, b, t, beat, rnd) {
      // D minor, relentless: Dm – B♭ – C – A.
      const chords = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]];
      const chord = chords[b % 4];
      timpani(o, t, chord[0] - 36, 0.5);
      timpani(o, t + beat * 2, chord[0] - 36, 0.4);
      if (rnd() > 0.5) timpani(o, t + beat * 3.5, chord[0] - 29, 0.3);
      snare(o, t + beat, 0.18);
      snare(o, t + beat * 3, 0.18);
      // Strings drive in sixteenths, voices hold the chord.
      for (let i = 0; i < 16; i++) pluck(o, t + i * beat * 0.25, chord[0] - 12 + (i % 4 === 2 ? 7 : 0), beat * 0.22, 0.045, i % 2 ? 0.4 : -0.4, 5);
      choir(o, t, chord, beat * 4, 0.04);
      bass(o, t, chord[0] - 24, beat * 1.9, 0.14);
      bass(o, t + beat * 2, chord[0] - 24, beat * 1.9, 0.12);
      if (b % 2 === 1) brass(o, t + beat * 2, [chord[0], chord[2]], beat * 1.8, 0.06);
      if (b % 8 === 0) cymbal(o, t, 0.1, 2);
      if (b % 8 === 7) for (let i = 0; i < 8; i++) tom(o, t + beat * 2 + i * beat * 0.25, 200 - i * 14, 0.3);
    },
  },
  victory: {
    bpm: 96,
    beats: 4,
    bars: 8,
    space: 0.35,
    bar(o, b, t, beat) {
      if (b % 8 === 0) {
        [60, 64, 67, 72].forEach((n, i) => brass(o, t + i * beat, [n, n - 12], beat * 0.9, 0.08));
        cymbal(o, t + beat * 3, 0.08);
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
  // Instruments play into `mix`, which reaches the bus dry and through the hall.
  const mix = c.createGain();
  mix.connect(out);
  const hall = c.createConvolver();
  hall.buffer = hallImpulse(c);
  const wet = c.createGain();
  wet.gain.value = theme.space * 0.9;
  mix.connect(hall).connect(wet).connect(out);
  const o = { c, out: mix };
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
      // The hall tail is cut once the fade is over.
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
