"use client";

/**
 * Ambience layers synthesised with Web Audio: continuous beds of filtered
 * noise shaped by slow modulation, plus scattered one-shot sounds (drops,
 * crackles, thunder, birds, clinks) placed around the listener in stereo.
 * Each layer has its own gain so the GM can mix them; nothing here ships
 * audio files.
 */
import { noise } from "./sfx";
import { hallImpulse } from "./music";
import type { AmbienceId } from "./catalog";

export interface AmbienceVoice {
  gain: GainNode;
  stop(fade?: number): void;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** A random spot in the stereo field (`width` 0 = centre, 1 = anywhere). */
function spot(c: AudioContext, out: AudioNode, width = 0.8): AudioNode {
  const p = c.createStereoPanner();
  p.pan.value = rand(-width, width);
  p.connect(out);
  return p;
}

/**
 * A looping noise bed through a filter chain. Two decorrelated copies are
 * spread left and right, so the bed sounds wide instead of coming from a point.
 */
function bed(c: AudioContext, out: AudioNode, filters: { type: BiquadFilterType; freq: number; q?: number }[], gain: number, width = 0.7) {
  const g = c.createGain();
  g.gain.value = gain;
  g.connect(out);
  const srcs: AudioBufferSourceNode[] = [];
  const nodes: BiquadFilterNode[] = [];
  for (const side of [-width, width]) {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    // A random start in the loop keeps the two sides (and two beds) from matching.
    src.start(0, Math.random() * 0.9);
    let node: AudioNode = src;
    for (const f of filters) {
      const filter = c.createBiquadFilter();
      filter.type = f.type;
      filter.frequency.value = f.freq;
      filter.Q.value = f.q ?? 0.7;
      node.connect(filter);
      node = filter;
      nodes.push(filter);
    }
    const pan = c.createStereoPanner();
    pan.pan.value = side;
    const half = c.createGain();
    half.gain.value = 0.6;
    node.connect(half).connect(pan).connect(g);
    srcs.push(src);
  }
  /** Moves every copy's filter `index` together. */
  const filterParam = (index: number) => nodes.filter((_, i) => i % filters.length === index).map((f) => f.frequency);
  return { srcs, filters: nodes, filterParam, gain: g };
}

/** A slow oscillator moving one or more parameters around their centre value. */
function lfo(c: AudioContext, target: AudioParam | AudioParam[], rate: number, depth: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = rate;
  const g = c.createGain();
  g.gain.value = depth;
  osc.connect(g);
  for (const t of Array.isArray(target) ? target : [target]) g.connect(t);
  osc.start();
  return osc;
}

/** A short noise hit (drop, crackle, footstep, clink body). */
function hit(c: AudioContext, out: AudioNode, at: number, freq: number, duration: number, gain: number, q = 4, type: BiquadFilterType = "bandpass") {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.8, duration + 0.05);
}

/** A short pitched blip (drip, chirp, clink, hoot). */
function blip(c: AudioContext, out: AudioNode, at: number, freq: number, duration: number, gain: number, slideTo?: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, duration / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/** A struck metal object: inharmonic partials ringing out (anvil, sword, chain, bell). */
function clang(c: AudioContext, out: AudioNode, at: number, freq: number, gain: number, decay = 1.2) {
  for (const [ratio, level, d] of [[1, 1, 1], [2.32, 0.6, 0.7], [4.25, 0.35, 0.4], [6.63, 0.2, 0.25]] as const) {
    const osc = c.createOscillator();
    osc.frequency.value = freq * ratio * rand(0.995, 1.005);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * level, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay * d);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + decay * d + 0.05);
  }
  hit(c, out, at, freq * 3, 0.03, gain * 0.8, 1);
}

/** A swelling noise sweep (a wave breaking, a gust, a crowd roar). */
function swell(c: AudioContext, out: AudioNode, at: number, freq: number, rise: number, fall: number, gain: number, type: BiquadFilterType = "lowpass") {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq * 0.6, at);
  f.frequency.linearRampToValueAtTime(freq, at + rise);
  f.frequency.linearRampToValueAtTime(freq * 0.5, at + rise + fall);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.8);
  src.stop(at + rise + fall + 0.1);
}

/** A bird's phrase: quick sweeping whistles. */
function birdsong(c: AudioContext, out: AudioNode, at: number) {
  const base = rand(2400, 4200);
  const notes = 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < notes; i++) {
    const f = base * rand(0.85, 1.2);
    blip(c, out, at + i * rand(0.08, 0.16), f, rand(0.05, 0.12), rand(0.025, 0.05), f * rand(0.7, 1.4));
  }
}

/** A frog's croak: a buzzy low pulse train. */
function croak(c: AudioContext, out: AudioNode, at: number) {
  const f = rand(120, 260);
  const pulses = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < pulses; i++) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, at + i * 0.09);
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, at + i * 0.09 + 0.07);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * 4;
    bp.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.1, at + i * 0.09 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.09 + 0.08);
    osc.connect(bp).connect(g).connect(out);
    osc.start(at + i * 0.09);
    osc.stop(at + i * 0.09 + 0.1);
  }
}

/** A word-like burst of babble: a vowel formant glide on a voice-pitched buzz. */
function murmur(c: AudioContext, out: AudioNode, at: number, gain: number) {
  const dur = rand(0.25, 0.7);
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  const pitch = rand(95, 230);
  osc.frequency.setValueAtTime(pitch, at);
  osc.frequency.linearRampToValueAtTime(pitch * rand(0.85, 1.2), at + dur);
  const f1 = c.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 5;
  f1.frequency.setValueAtTime(rand(400, 800), at);
  f1.frequency.linearRampToValueAtTime(rand(400, 900), at + dur);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1600;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.05);
  g.gain.linearRampToValueAtTime(0.0001, at + dur);
  osc.connect(f1).connect(lp).connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/**
 * Fires `fn` at random intervals between min and max seconds until stopped.
 * Nothing is queued while the browser holds the sound back (a suspended
 * context would otherwise pile up sounds and play them all at once later).
 */
function scatter(c: AudioContext, min: number, max: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const next = () => {
    timer = setTimeout(() => {
      if (c.state === "running") fn();
      next();
    }, rand(min, max) * 1000);
  };
  next();
  return () => clearTimeout(timer);
}

/** An echo for caves and dungeons. */
function echo(c: AudioContext, out: AudioNode, time: number, feedback: number) {
  const delay = c.createDelay(2);
  delay.delayTime.value = time;
  const fb = c.createGain();
  fb.gain.value = feedback;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2500;
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(out);
  return { input: delay, release: () => [delay, lp, fb].forEach((n) => n.disconnect()) };
}

/** A room's reverb: sounds sent here ring in a hall. */
function room(c: AudioContext, out: AudioNode, level: number) {
  const conv = c.createConvolver();
  conv.buffer = hallImpulse(c);
  const g = c.createGain();
  g.gain.value = level;
  conv.connect(g).connect(out);
  return conv;
}

const now = (c: AudioContext, lead = 0.02) => c.currentTime + lead;

type Built = { sources: AudioScheduledSourceNode[]; stops: (() => void)[] };
type Builder = (c: AudioContext, out: GainNode) => Built;

const BUILDERS: Record<AmbienceId, Builder> = {
  rain: (c, out) => {
    const a = bed(c, out, [{ type: "highpass", freq: 700 }, { type: "lowpass", freq: 6500 }], 0.22, 0.9);
    const b = bed(c, out, [{ type: "lowpass", freq: 400 }], 0.12);
    const drops = scatter(c, 0.03, 0.1, () => hit(c, spot(c, out, 1), now(c, 0.01), rand(2500, 6500), 0.03, rand(0.04, 0.1), 8));
    // Fat drops on a roof or leaf, now and then.
    const plops = scatter(c, 0.4, 1.4, () => blip(c, spot(c, out), now(c), rand(700, 1400), 0.06, 0.04, rand(300, 500)));
    return { sources: [...a.srcs, ...b.srcs], stops: [drops, plops] };
  },
  storm: (c, out) => {
    const rain = bed(c, out, [{ type: "highpass", freq: 500 }, { type: "lowpass", freq: 7500 }], 0.32, 0.9);
    const roar = bed(c, out, [{ type: "lowpass", freq: 250 }], 0.2);
    const gust = lfo(c, roar.gain.gain, 0.08, 0.12);
    const thunder = scatter(c, 7, 18, () => {
      const t = now(c, 0.05);
      const where = spot(c, out, 0.7);
      hit(c, where, t, 1800, 0.25, 0.25, 1, "highpass"); // the crack
      // The roll: a few rumbles, fading.
      for (let i = 0; i < 3; i++) swell(c, where, t + i * rand(0.3, 0.9), rand(180, 400), 0.12, rand(2, 4), 0.7 / (i + 1));
    });
    return { sources: [...rain.srcs, ...roar.srcs, gust], stops: [thunder] };
  },
  wind: (c, out) => {
    const w = bed(c, out, [{ type: "bandpass", freq: 500, q: 1.4 }], 0.4, 0.9);
    const sweep = lfo(c, w.filterParam(0), 0.06, 300);
    const swellGain = lfo(c, w.gain.gain, 0.11, 0.22);
    const low = bed(c, out, [{ type: "lowpass", freq: 180 }], 0.12);
    // Whistling gusts through gaps.
    const whistle = scatter(c, 5, 12, () => swell(c, spot(c, out), now(c), rand(900, 1600), rand(1, 2), rand(1.5, 3), 0.08, "bandpass"));
    return { sources: [...w.srcs, sweep, swellGain, ...low.srcs], stops: [whistle] };
  },
  blizzard: (c, out) => {
    const hiss = bed(c, out, [{ type: "highpass", freq: 2500 }, { type: "lowpass", freq: 9000 }], 0.12, 1);
    const howl = bed(c, out, [{ type: "bandpass", freq: 650, q: 2.5 }], 0.45, 0.9);
    const pitch = lfo(c, howl.filterParam(0), 0.05, 380);
    const surge = lfo(c, howl.gain.gain, 0.09, 0.3);
    const low = bed(c, out, [{ type: "lowpass", freq: 120 }], 0.18);
    const gusts = scatter(c, 3, 7, () => swell(c, spot(c, out), now(c), rand(1200, 2200), rand(0.8, 1.5), rand(1.5, 2.5), 0.12, "bandpass"));
    return { sources: [...hiss.srcs, ...howl.srcs, pitch, surge, ...low.srcs], stops: [gusts] };
  },
  day: (c, out) => {
    const breeze = bed(c, out, [{ type: "bandpass", freq: 900, q: 0.7 }], 0.16, 1);
    const sway = lfo(c, breeze.gain.gain, 0.07, 0.03);
    const birds = scatter(c, 0.8, 3, () => birdsong(c, spot(c, out, 1), now(c)));
    const cuckoo = scatter(c, 12, 28, () => {
      const t = now(c, 0.05);
      const where = spot(c, out, 0.9);
      blip(c, where, t, 760, 0.22, 0.04, 740);
      blip(c, where, t + 0.3, 620, 0.32, 0.035, 600);
    });
    const bees = scatter(c, 6, 15, () => {
      const t = now(c);
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = rand(190, 240);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const g = c.createGain();
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(rand(-1, 0), t);
      p.pan.linearRampToValueAtTime(rand(0, 1), t + 2.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      osc.connect(lp).connect(g).connect(p).connect(out);
      osc.start(t);
      osc.stop(t + 2.6);
    });
    return { sources: [...breeze.srcs, sway], stops: [birds, cuckoo, bees] };
  },
  forest: (c, out) => {
    const breeze = bed(c, out, [{ type: "bandpass", freq: 800, q: 0.8 }], 0.08, 1);
    const sway = lfo(c, breeze.gain.gain, 0.09, 0.03);
    // Crickets: quick chirp trains at slightly different pitches, all around.
    const crickets = scatter(c, 0.2, 0.7, () => {
      const f = rand(4200, 5100);
      const t = now(c, 0.01);
      const where = spot(c, out, 1);
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) blip(c, where, t + i * 0.045, f, 0.03, 0.022);
    });
    const owl = scatter(c, 9, 22, () => {
      const t = now(c, 0.05);
      const where = spot(c, out, 0.9);
      blip(c, where, t, 410, 0.35, 0.08, 380);
      blip(c, where, t + 0.5, 400, 0.6, 0.07, 360);
    });
    const twig = scatter(c, 6, 16, () => hit(c, spot(c, out), now(c), rand(1500, 3000), 0.02, 0.15, 3));
    return { sources: [...breeze.srcs, sway], stops: [crickets, owl, twig] };
  },
  stream: (c, out) => {
    const flow = bed(c, out, [{ type: "bandpass", freq: 1400, q: 0.6 }], 0.13, 0.8);
    const ripple = lfo(c, flow.filterParam(0), 0.4, 500);
    const deep = bed(c, out, [{ type: "lowpass", freq: 500 }], 0.08);
    // Bubbles: tiny rising tones, the sound of running water.
    const bubbles = scatter(c, 0.03, 0.15, () => {
      const f = rand(400, 1400);
      blip(c, spot(c, out, 0.8), now(c, 0.01), f, rand(0.03, 0.07), rand(0.01, 0.03), f * rand(1.4, 2.2));
    });
    const birds = scatter(c, 4, 10, () => birdsong(c, spot(c, out, 1), now(c)));
    return { sources: [...flow.srcs, ripple, ...deep.srcs], stops: [bubbles, birds] };
  },
  swamp: (c, out) => {
    const air = bed(c, out, [{ type: "lowpass", freq: 600 }], 0.2);
    const insects = bed(c, out, [{ type: "bandpass", freq: 6000, q: 8 }], 0.03, 1);
    const buzz = lfo(c, insects.gain.gain, 13, 0.02, "square");
    const frogs = scatter(c, 0.4, 1.8, () => croak(c, spot(c, out, 1), now(c)));
    const gulp = scatter(c, 3, 9, () => {
      const f = rand(150, 300);
      blip(c, spot(c, out), now(c), f, 0.15, 0.08, f * 2.5);
    });
    const mosquito = scatter(c, 8, 20, () => {
      const t = now(c);
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(rand(550, 650), t);
      osc.frequency.linearRampToValueAtTime(rand(580, 700), t + 1.5);
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(rand(-1, 1), t);
      p.pan.linearRampToValueAtTime(rand(-1, 1), t + 1.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.008, t + 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g).connect(p).connect(out);
      osc.start(t);
      osc.stop(t + 1.7);
    });
    return { sources: [...air.srcs, ...insects.srcs, buzz], stops: [frogs, gulp, mosquito] };
  },
  ocean: (c, out) => {
    const sea = bed(c, out, [{ type: "lowpass", freq: 650 }], 0.14);
    const foam = bed(c, out, [{ type: "highpass", freq: 2500 }], 0.03, 1);
    // Waves arrive one by one, from slightly different sides, and wash out.
    const waves = scatter(c, 4, 8, () => {
      const where = spot(c, out, 0.6);
      const t = now(c);
      swell(c, where, t, rand(700, 1000), rand(1.8, 2.6), rand(2.5, 3.5), 0.35);
      swell(c, where, t + 1.6, rand(3000, 5000), 0.5, rand(2, 3), 0.06, "highpass");
    });
    const gulls = scatter(c, 14, 30, () => {
      const t = now(c, 0.05);
      const where = spot(c, out, 1);
      blip(c, where, t, 1800, 0.25, 0.03, 1400, "triangle");
      blip(c, where, t + 0.3, 1900, 0.2, 0.025, 1500, "triangle");
    });
    return { sources: [...sea.srcs, ...foam.srcs], stops: [waves, gulls] };
  },
  fire: (c, out) => {
    const roar = bed(c, out, [{ type: "lowpass", freq: 300 }], 0.18, 0.4);
    const flicker = lfo(c, roar.gain.gain, 0.7, 0.06);
    const crackle = scatter(c, 0.04, 0.3, () => hit(c, spot(c, out, 0.4), now(c, 0.01), rand(1200, 4700), rand(0.012, 0.04), rand(0.12, 0.32), 3));
    const pop = scatter(c, 1.5, 5, () => hit(c, spot(c, out, 0.4), now(c, 0.01), 700, 0.06, 0.35, 2));
    const hiss = scatter(c, 5, 12, () => swell(c, out, now(c), 5000, 0.3, 1.2, 0.03, "highpass"));
    return { sources: [...roar.srcs, flicker], stops: [crackle, pop, hiss] };
  },
  tavern: (c, out) => {
    const hall = room(c, out, 0.25);
    const hum = bed(c, out, [{ type: "bandpass", freq: 450, q: 1.5 }], 0.3, 0.9);
    // Many people talking: word-like bursts all around, into a warm room.
    const chatter = scatter(c, 0.08, 0.3, () => {
      const where = spot(c, out, 1);
      murmur(c, where, now(c), rand(0.025, 0.06));
    });
    const laugh = scatter(c, 6, 15, () => {
      const t = now(c);
      const where = spot(c, out, 0.9);
      const pitch = rand(180, 300);
      for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) blip(c, where, t + i * 0.13, pitch * rand(0.95, 1.1), 0.09, 0.025, pitch * 0.85, "sawtooth");
    });
    const clinks = scatter(c, 1.2, 4.5, () => {
      const t = now(c);
      const f = rand(2200, 3800);
      const where = spot(c, out, 0.9);
      blip(c, where, t, f, 0.25, 0.05, undefined, "triangle");
      blip(c, where, t + 0.07, f * 1.33, 0.18, 0.03, undefined, "triangle");
      blip(c, hall, t, f, 0.2, 0.03, undefined, "triangle");
    });
    const thud = scatter(c, 3, 9, () => hit(c, spot(c, out), now(c), 160, 0.12, 0.3, 1, "lowpass"));
    const chair = scatter(c, 8, 18, () => swell(c, spot(c, out), now(c), rand(500, 900), 0.08, 0.3, 0.08, "bandpass"));
    return { sources: [...hum.srcs], stops: [chatter, laugh, clinks, thud, chair] };
  },
  market: (c, out) => {
    const crowd = bed(c, out, [{ type: "bandpass", freq: 550, q: 1.2 }], 0.32, 1);
    const ebb = lfo(c, crowd.gain.gain, 0.05, 0.03);
    const chatter = scatter(c, 0.05, 0.18, () => murmur(c, spot(c, out, 1), now(c), rand(0.025, 0.055)));
    // A vendor calling out: a louder, longer voice.
    const crier = scatter(c, 5, 12, () => {
      const t = now(c);
      const where = spot(c, out, 0.9);
      murmur(c, where, t, 0.09);
      murmur(c, where, t + 0.5, 0.08);
    });
    const hooves = scatter(c, 10, 22, () => {
      const t = now(c);
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(-0.9, t);
      p.pan.linearRampToValueAtTime(0.9, t + 3.5);
      p.connect(out);
      for (let i = 0; i < 14; i++) hit(c, p, t + i * 0.25 + (i % 2) * 0.08, rand(400, 700), 0.05, 0.12, 2);
    });
    const bell = scatter(c, 20, 45, () => clang(c, spot(c, out, 0.5), now(c), 330, 0.04, 3));
    return { sources: [...crowd.srcs, ebb], stops: [chatter, crier, hooves, bell] };
  },
  forge: (c, out) => {
    const fire = bed(c, out, [{ type: "lowpass", freq: 350 }], 0.15, 0.4);
    // The bellows breathe in and out.
    const bellows = lfo(c, fire.gain.gain, 0.25, 0.1);
    const hammer = scatter(c, 2.5, 5, () => {
      const t = now(c);
      const where = spot(c, out, 0.3);
      const blows = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < blows; i++) clang(c, where, t + i * 0.45, rand(820, 880), 0.09, 1.4);
    });
    const quench = scatter(c, 15, 30, () => swell(c, spot(c, out, 0.3), now(c), 4500, 0.05, 2.5, 0.12, "highpass"));
    return { sources: [...fire.srcs, bellows], stops: [hammer, quench] };
  },
  ship: (c, out) => {
    const water = bed(c, out, [{ type: "lowpass", freq: 500 }], 0.12);
    const roll = lfo(c, water.gain.gain, 0.12, 0.08);
    const sails = bed(c, out, [{ type: "bandpass", freq: 400, q: 1.6 }], 0.05, 1);
    const flap = lfo(c, sails.gain.gain, 0.3, 0.04);
    // Wooden creaks: slow, groaning tones.
    const creak = scatter(c, 2, 6, () => {
      const t = now(c);
      const f = rand(180, 400);
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * rand(0.8, 1.25), t + 0.6);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f * 3;
      bp.Q.value = 6;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(bp).connect(g).connect(spot(c, out, 0.8));
      osc.start(t);
      osc.stop(t + 0.75);
    });
    const ropes = scatter(c, 5, 12, () => hit(c, spot(c, out), now(c), 900, 0.15, 0.08, 2));
    const bell = scatter(c, 30, 60, () => {
      const t = now(c);
      const where = spot(c, out, 0.5);
      clang(c, where, t, 880, 0.04, 2);
      clang(c, where, t + 0.5, 880, 0.04, 2);
    });
    return { sources: [...water.srcs, roll, ...sails.srcs, flap], stops: [creak, ropes, bell] };
  },
  dungeon: (c, out) => {
    const cave = echo(c, out, 0.37, 0.45);
    const drone1 = c.createOscillator();
    const drone2 = c.createOscillator();
    drone1.frequency.value = 55;
    drone2.frequency.value = 55.6;
    const dg = c.createGain();
    dg.gain.value = 0.05;
    drone1.connect(dg);
    drone2.connect(dg);
    dg.connect(out);
    drone1.start();
    drone2.start();
    const air = bed(c, out, [{ type: "bandpass", freq: 220, q: 2 }], 0.05);
    const drips = scatter(c, 1, 4, () => {
      const t = now(c, 0.01);
      const f = rand(900, 1800);
      const where = spot(c, out, 0.9);
      blip(c, where, t, f, 0.09, 0.09, f * 0.6);
      blip(c, cave.input, t, f, 0.09, 0.07, f * 0.6);
    });
    // Chains shifting somewhere down the corridor.
    const chains = scatter(c, 12, 28, () => {
      const t = now(c);
      const where = spot(c, cave.input, 0.8);
      for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++) clang(c, where, t + i * rand(0.05, 0.12), rand(1800, 2600), 0.015, 0.4);
    });
    const steps = scatter(c, 20, 40, () => {
      const t = now(c);
      for (let i = 0; i < 4; i++) hit(c, cave.input, t + i * 0.55, 200, 0.08, 0.12, 1, "lowpass");
    });
    // The feedback loop is released on stop, so it can't linger.
    return { sources: [drone1, drone2, ...air.srcs], stops: [drips, chains, steps, () => setTimeout(cave.release, 2000)] };
  },
  battle: (c, out) => {
    const hall = room(c, out, 0.6);
    // A distant roar of many voices, rising and falling.
    const roar = bed(c, out, [{ type: "bandpass", freq: 420, q: 1.3 }, { type: "lowpass", freq: 900 }], 0.45, 1);
    const tide = lfo(c, roar.gain.gain, 0.07, 0.12);
    const swords = scatter(c, 0.3, 1.2, () => {
      const where = spot(c, hall, 1);
      clang(c, where, now(c), rand(1400, 2600), rand(0.015, 0.04), 0.5);
    });
    const shouts = scatter(c, 1, 3, () => {
      const where = spot(c, hall, 1);
      murmur(c, where, now(c), 0.03);
    });
    const horn = scatter(c, 18, 40, () => {
      const t = now(c);
      const where = spot(c, hall, 0.6);
      for (const [f, d] of [[146.8, 1.2], [220, 2.2]] as const) {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        const g = c.createGain();
        const start = t + (f > 200 ? 1.2 : 0);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(0.05, start + 0.2);
        g.gain.linearRampToValueAtTime(0.0001, start + d);
        osc.connect(lp).connect(g).connect(where);
        osc.start(start);
        osc.stop(start + d + 0.05);
      }
    });
    const drums = scatter(c, 6, 14, () => {
      const t = now(c);
      for (let i = 0; i < 6; i++) hit(c, hall, t + i * 0.5, 90, 0.4, 0.4, 1, "lowpass");
    });
    return { sources: [...roar.srcs, tide], stops: [swords, shouts, horn, drums] };
  },
  volcano: (c, out) => {
    const rumble = bed(c, out, [{ type: "lowpass", freq: 90 }], 0.4);
    const quake = lfo(c, rumble.gain.gain, 0.15, 0.2);
    const heat = bed(c, out, [{ type: "bandpass", freq: 1800, q: 0.8 }], 0.03, 1);
    // Thick lava bubbles popping.
    const bubbles = scatter(c, 0.3, 1.2, () => {
      const f = rand(70, 160);
      const where = spot(c, out, 0.8);
      blip(c, where, now(c), f, rand(0.15, 0.3), 0.12, f * 2.2);
      hit(c, where, now(c, 0.2), 400, 0.06, 0.08, 2);
    });
    const eruption = scatter(c, 15, 35, () => {
      const t = now(c);
      swell(c, spot(c, out, 0.5), t, 220, 0.4, 4, 0.6);
      for (let i = 0; i < 10; i++) hit(c, spot(c, out, 1), t + 0.5 + i * rand(0.1, 0.3), rand(300, 1200), 0.08, 0.1, 2);
    });
    return { sources: [...rumble.srcs, quake, ...heat.srcs], stops: [bubbles, eruption] };
  },
  ritual: (c, out) => {
    const hall = room(c, out, 0.7);
    // A low chant drone on two voices, slightly beating.
    const voice = c.createGain();
    voice.gain.value = 0.05;
    voice.connect(hall);
    voice.connect(out);
    const vowel = c.createBiquadFilter();
    vowel.type = "bandpass";
    vowel.frequency.value = 520;
    vowel.Q.value = 4;
    vowel.connect(voice);
    const chant = [73.4, 110, 73.9].map((f) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(vowel);
      osc.start();
      return osc;
    });
    // The chant breathes, and its vowel slowly turns from "oh" to "ah".
    const breathe = lfo(c, voice.gain, 0.12, 0.03);
    const mouth = lfo(c, vowel.frequency, 0.05, 200);
    const drum = scatter(c, 1.6, 1.6, () => {
      const t = now(c);
      hit(c, hall, t, 80, 0.5, 0.5, 1, "lowpass");
      hit(c, hall, t + 0.4, 80, 0.4, 0.3, 1, "lowpass");
    });
    const whisper = scatter(c, 4, 9, () => swell(c, spot(c, hall, 1), now(c), rand(2500, 4000), rand(0.4, 0.8), rand(0.6, 1.2), 0.05, "bandpass"));
    const gong = scatter(c, 25, 50, () => clang(c, spot(c, hall, 0.4), now(c), 110, 0.08, 6));
    return { sources: [...chant, breathe, mouth], stops: [drum, whisper, gong] };
  },
};

/** Starts a layer, fading in to `volume`. */
export function startAmbience(c: AudioContext, bus: AudioNode, id: AmbienceId, volume: number): AmbienceVoice {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 2);
  out.connect(bus);
  const { sources, stops } = BUILDERS[id](c, out);
  return {
    gain: out,
    stop(fade = 1.5) {
      stops.forEach((s) => s());
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            // Already stopped.
          }
        });
        out.disconnect();
      }, fade * 1000 + 100);
    },
  };
}
