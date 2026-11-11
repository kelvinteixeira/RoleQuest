"use client";

/**
 * Table sound effects, synthesised with the Web Audio API (no audio files to
 * ship or license). Everything goes through one effects bus with its own
 * volume. Music and ambience (audio centre) share the context, on their own buses.
 */
export type SfxName = "dice" | "dice-hit" | "crit" | "fumble" | "hit" | "heal" | "door-open" | "door-close" | "gate" | "trap" | "combat" | "fire" | "step";

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; bus: GainNode } | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    bus = ctx.createGain();
    bus.connect(ctx.destination);
  }
  // Browsers start the context suspended until the page gets a user gesture.
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, bus: bus! };
}

/** The page's audio context (shared by effects, music and ambience); null where Web Audio is missing. */
export function sharedAudioContext(): AudioContext | null {
  return audio()?.ctx ?? null;
}

/** Browsers keep audio off until the page gets a click or key press. */
export function audioLocked(): boolean {
  return !!ctx && ctx.state !== "running";
}

export async function unlockAudio(): Promise<void> {
  await audio()?.ctx.resume();
}

export function setEffectsVolume(volume: number) {
  const a = audio();
  if (a) a.bus.gain.value = Math.max(0, Math.min(1, volume));
}

export function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Filtered noise burst. */
function burst(c: AudioContext, out: AudioNode, at: number, { duration, freq, q = 1, gain = 0.5, type = "bandpass" as BiquadFilterType, sweepTo }: { duration: number; freq: number; q?: number; gain?: number; type?: BiquadFilterType; sweepTo?: number }) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + duration);
  src.connect(filter).connect(g).connect(out);
  src.start(at, Math.random() * 0.5, duration + 0.05);
}

/** Pitched tone with a quick envelope. */
function tone(c: AudioContext, out: AudioNode, at: number, { freq, duration, type = "sine" as OscillatorType, gain = 0.3, slideTo }: { freq: number; duration: number; type?: OscillatorType; gain?: number; slideTo?: number }) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

const SOUNDS: Record<SfxName, (c: AudioContext, out: AudioNode, t: number) => void> = {
  // Dice rattling on wood: a handful of short clicks.
  dice: (c, out, t) => {
    for (let i = 0; i < 7; i++) burst(c, out, t + i * 0.045 + Math.random() * 0.03, { duration: 0.04, freq: 2400 + Math.random() * 1800, q: 6, gain: 0.35 - i * 0.03 });
  },
  // One die striking the table: a hard click with a little wooden body under it.
  "dice-hit": (c, out, t) => {
    burst(c, out, t, { duration: 0.035, freq: 2600 + Math.random() * 1400, q: 5, gain: 0.4 });
    tone(c, out, t, { freq: 180 + Math.random() * 60, slideTo: 120, duration: 0.07, type: "triangle", gain: 0.18 });
  },
  // Natural 20: a rising shimmer that opens into a bright major chord.
  crit: (c, out, t) => {
    burst(c, out, t, { duration: 0.5, freq: 2000, q: 2, gain: 0.12, sweepTo: 9000 });
    [523, 659, 784, 1047].forEach((f, i) => tone(c, out, t + 0.12 + i * 0.05, { freq: f, duration: 1.2, type: "triangle", gain: 0.11 }));
    tone(c, out, t + 0.12, { freq: 131, duration: 1.1, type: "sine", gain: 0.35 });
  },
  // Natural 1: a heavy thud and a sour, falling pair of notes.
  fumble: (c, out, t) => {
    tone(c, out, t, { freq: 90, slideTo: 40, duration: 0.5, type: "sine", gain: 0.6 });
    [311, 294].forEach((f, i) => tone(c, out, t + 0.15 + i * 0.28, { freq: f, slideTo: f * 0.94, duration: 0.45, type: "sawtooth", gain: 0.05 }));
    burst(c, out, t, { duration: 0.4, freq: 300, q: 0.7, gain: 0.3, type: "lowpass" });
  },
  hit: (c, out, t) => {
    tone(c, out, t, { freq: 140, slideTo: 55, duration: 0.22, type: "triangle", gain: 0.5 });
    burst(c, out, t, { duration: 0.12, freq: 900, q: 0.8, gain: 0.35 });
  },
  heal: (c, out, t) => {
    [660, 880, 1320].forEach((f, i) => tone(c, out, t + i * 0.07, { freq: f, duration: 0.5, gain: 0.12 }));
  },
  "door-open": (c, out, t) => {
    // Creak: a slow, resonant sweep.
    tone(c, out, t, { freq: 220, slideTo: 340, duration: 0.55, type: "sawtooth", gain: 0.05 });
    burst(c, out, t, { duration: 0.6, freq: 500, q: 12, gain: 0.25, sweepTo: 900 });
  },
  "door-close": (c, out, t) => {
    burst(c, out, t, { duration: 0.18, freq: 300, q: 1.2, gain: 0.6, type: "lowpass" });
    tone(c, out, t, { freq: 90, slideTo: 60, duration: 0.2, type: "triangle", gain: 0.35 });
  },
  gate: (c, out, t) => {
    // Iron: inharmonic partials ringing out.
    [523, 1170, 1840].forEach((f) => tone(c, out, t, { freq: f, duration: 0.7, type: "square", gain: 0.03 }));
    for (let i = 0; i < 5; i++) burst(c, out, t + i * 0.08, { duration: 0.05, freq: 3000, q: 10, gain: 0.15 });
  },
  trap: (c, out, t) => {
    burst(c, out, t, { duration: 0.08, freq: 3500, q: 4, gain: 0.5 });
    tone(c, out, t + 0.02, { freq: 1600, slideTo: 300, duration: 0.18, type: "sawtooth", gain: 0.08 });
    burst(c, out, t + 0.05, { duration: 0.25, freq: 600, q: 1, gain: 0.35, type: "lowpass" });
  },
  combat: (c, out, t) => {
    [0, 0.18, 0.36].forEach((d, i) => tone(c, out, t + d, { freq: i === 2 ? 70 : 82, slideTo: 40, duration: 0.35, type: "sine", gain: 0.6 }));
  },
  fire: (c, out, t) => {
    burst(c, out, t, { duration: 0.5, freq: 400, q: 0.6, gain: 0.3, sweepTo: 1600 });
  },
  step: (c, out, t) => {
    burst(c, out, t, { duration: 0.06, freq: 260, q: 1, gain: 0.25, type: "lowpass" });
    burst(c, out, t + 0.16, { duration: 0.06, freq: 240, q: 1, gain: 0.2, type: "lowpass" });
  },
};

export function playSfx(name: SfxName, delay = 0) {
  const a = audio();
  if (!a) return;
  SOUNDS[name](a.ctx, a.bus, a.ctx.currentTime + delay);
}
