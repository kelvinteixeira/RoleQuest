"use client";

/**
 * Ambience layers synthesised with Web Audio: continuous beds of filtered
 * noise shaped by slow modulation, plus scattered one-shot sounds (drops,
 * crackles, thunder, crickets, clinks). Each layer has its own gain so the GM
 * can mix them; nothing here ships audio files.
 */
import { noise } from "./sfx";
import type { AmbienceId } from "./catalog";

export interface AmbienceVoice {
  gain: GainNode;
  stop(fade?: number): void;
}

/** A looping noise bed through a filter chain. */
function bed(c: AudioContext, out: AudioNode, filters: { type: BiquadFilterType; freq: number; q?: number }[], gain: number) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  // A random start in the loop keeps two beds from sounding identical.
  src.start(0, Math.random() * 0.9);
  let node: AudioNode = src;
  const nodes: BiquadFilterNode[] = [];
  for (const f of filters) {
    const filter = c.createBiquadFilter();
    filter.type = f.type;
    filter.frequency.value = f.freq;
    filter.Q.value = f.q ?? 0.7;
    node.connect(filter);
    node = filter;
    nodes.push(filter);
  }
  const g = c.createGain();
  g.gain.value = gain;
  node.connect(g).connect(out);
  return { src, filters: nodes, gain: g };
}

/** A slow oscillator moving a parameter around a centre value. */
function lfo(c: AudioContext, target: AudioParam, rate: number, depth: number) {
  const osc = c.createOscillator();
  osc.frequency.value = rate;
  const g = c.createGain();
  g.gain.value = depth;
  osc.connect(g).connect(target);
  osc.start();
  return osc;
}

/** A short noise hit (drop, crackle, clink body). */
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
    }, (min + Math.random() * (max - min)) * 1000);
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

type Builder = (c: AudioContext, out: GainNode) => { sources: AudioScheduledSourceNode[]; stops: (() => void)[] };

const BUILDERS: Record<AmbienceId, Builder> = {
  rain: (c, out) => {
    const a = bed(c, out, [{ type: "highpass", freq: 700 }, { type: "lowpass", freq: 6500 }], 0.22);
    const b = bed(c, out, [{ type: "lowpass", freq: 400 }], 0.12);
    const drops = scatter(c, 0.03, 0.12, () => hit(c, out, c.currentTime + 0.01, 2500 + Math.random() * 4000, 0.03, 0.05 + Math.random() * 0.05, 8));
    return { sources: [a.src, b.src], stops: [drops] };
  },
  storm: (c, out) => {
    const rain = bed(c, out, [{ type: "highpass", freq: 500 }, { type: "lowpass", freq: 7500 }], 0.32);
    const roar = bed(c, out, [{ type: "lowpass", freq: 250 }], 0.2);
    const gust = lfo(c, roar.gain.gain, 0.08, 0.12);
    const thunder = scatter(c, 7, 18, () => {
      const t = c.currentTime + 0.05;
      hit(c, out, t, 1800, 0.25, 0.25, 1, "highpass"); // the crack
      const src = c.createBufferSource();
      src.buffer = noise(c);
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.exponentialRampToValueAtTime(80, t + 4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      src.connect(lp).connect(g).connect(out);
      src.start(t);
      src.stop(t + 4.6);
    });
    return { sources: [rain.src, roar.src, gust], stops: [thunder] };
  },
  wind: (c, out) => {
    const w = bed(c, out, [{ type: "bandpass", freq: 500, q: 1.4 }], 0.4);
    const sweep = lfo(c, w.filters[0].frequency, 0.06, 300);
    const swell = lfo(c, w.gain.gain, 0.11, 0.22);
    const low = bed(c, out, [{ type: "lowpass", freq: 180 }], 0.12);
    return { sources: [w.src, sweep, swell, low.src], stops: [] };
  },
  fire: (c, out) => {
    const roar = bed(c, out, [{ type: "lowpass", freq: 300 }], 0.18);
    const flicker = lfo(c, roar.gain.gain, 0.7, 0.06);
    const crackle = scatter(c, 0.04, 0.35, () => hit(c, out, c.currentTime + 0.01, 1200 + Math.random() * 3500, 0.012 + Math.random() * 0.03, 0.12 + Math.random() * 0.2, 3));
    const pop = scatter(c, 1.5, 5, () => hit(c, out, c.currentTime + 0.01, 700, 0.06, 0.35, 2));
    return { sources: [roar.src, flicker], stops: [crackle, pop] };
  },
  forest: (c, out) => {
    const breeze = bed(c, out, [{ type: "bandpass", freq: 800, q: 0.8 }], 0.06);
    const sway = lfo(c, breeze.gain.gain, 0.09, 0.03);
    // Crickets: quick chirp trains at slightly different pitches.
    const crickets = scatter(c, 0.25, 0.9, () => {
      const f = 4200 + Math.random() * 900;
      const t = c.currentTime + 0.01;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) blip(c, out, t + i * 0.045, f, 0.03, 0.025);
    });
    const owl = scatter(c, 9, 22, () => {
      const t = c.currentTime + 0.05;
      blip(c, out, t, 410, 0.35, 0.08, 380);
      blip(c, out, t + 0.5, 400, 0.6, 0.07, 360);
    });
    return { sources: [breeze.src, sway], stops: [crickets, owl] };
  },
  dungeon: (c, out) => {
    const cave = echo(c, out, 0.37, 0.45);
    const room = cave.input;
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
      const t = c.currentTime + 0.01;
      const f = 900 + Math.random() * 900;
      blip(c, out, t, f, 0.09, 0.09, f * 0.6);
      blip(c, room, t, f, 0.09, 0.07, f * 0.6);
    });
    // The feedback loop is released on stop, so it can't linger.
    return { sources: [drone1, drone2, air.src], stops: [drips, () => setTimeout(cave.release, 2000)] };
  },
  tavern: (c, out) => {
    // Murmur: overlapping voice-band noise, each breathing at its own pace.
    const voices = [320, 480, 650].map((f, i) => {
      const v = bed(c, out, [{ type: "bandpass", freq: f, q: 3 }], 0.07);
      return [v.src, lfo(c, v.gain.gain, 0.3 + i * 0.17, 0.05)];
    });
    const clinks = scatter(c, 1.2, 4.5, () => {
      const t = c.currentTime + 0.01;
      const f = 2200 + Math.random() * 1600;
      blip(c, out, t, f, 0.25, 0.05, undefined, "triangle");
      blip(c, out, t + 0.07, f * 1.33, 0.18, 0.03, undefined, "triangle");
    });
    const thud = scatter(c, 3, 9, () => hit(c, out, c.currentTime + 0.01, 160, 0.12, 0.3, 1, "lowpass"));
    return { sources: voices.flat(), stops: [clinks, thud] };
  },
  ocean: (c, out) => {
    const swell = bed(c, out, [{ type: "lowpass", freq: 650 }], 0.2);
    const waves = lfo(c, swell.gain.gain, 0.13, 0.17);
    const foam = bed(c, out, [{ type: "highpass", freq: 2500 }], 0.04);
    const fizz = lfo(c, foam.gain.gain, 0.13, 0.035);
    const gulls = scatter(c, 14, 30, () => {
      const t = c.currentTime + 0.05;
      blip(c, out, t, 1800, 0.25, 0.03, 1400, "triangle");
      blip(c, out, t + 0.3, 1900, 0.2, 0.025, 1500, "triangle");
    });
    return { sources: [swell.src, waves, foam.src, fizz], stops: [gulls] };
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
