/**
 * Renders the episode's soundtrack in this browser (Web Audio, offline): no
 * key, no download, the same file in the preview and in the exported MP4.
 */
import { MOOD_VOICING, type MusicHit, type MusicPlan, type MusicSegment } from "../model/audio-mix";
import { floatToWav } from "../model/wav";

const SAMPLE_RATE = 24_000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function pad(ctx: OfflineAudioContext, out: AudioNode, seg: MusicSegment) {
  const voicing = MOOD_VOICING[seg.mood];
  // Overlap the neighbours: a crossfade instead of a cut between scenes.
  const start = Math.max(0, seg.from - 0.6);
  const end = seg.to + 0.6;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = voicing.brightness;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.32 / Math.sqrt(seg.chord.length), start + 1.2);
  gain.gain.setValueAtTime(0.32 / Math.sqrt(seg.chord.length), end - 1.2);
  gain.gain.linearRampToValueAtTime(0, end);
  filter.connect(gain).connect(out);
  seg.chord.forEach((note, i) => {
    // Two slightly detuned oscillators per note: a warm, moving pad.
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sawtooth";
      osc.frequency.value = hz(note);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(start);
      osc.stop(end);
    }
  });
  const { pulse, pulseKind } = voicing;
  if (!pulse) return;
  for (let t = seg.from, n = 0; t < seg.to - 0.1; t += 1 / pulse, n++) {
    if (pulseKind === "pluck") pluck(ctx, out, hz(seg.chord[n % seg.chord.length] + 12), t, 0.18);
    else if (pulseKind === "heart") {
      drum(ctx, out, t, 70, 0.16);
      drum(ctx, out, t + 0.22, 60, 0.1);
    } else drum(ctx, out, t, 90, n % 2 === 0 ? 0.3 : 0.18);
  }
}

function pluck(ctx: OfflineAudioContext, out: AudioNode, freq: number, at: number, level: number) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.4);
}

function drum(ctx: OfflineAudioContext, out: AudioNode, at: number, freq: number, level: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq / 2, at + 0.25);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.45);
}

function noise(ctx: OfflineAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: the same episode always renders the same file.
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
}

function hit(ctx: OfflineAudioContext, out: AudioNode, { at, kind }: MusicHit) {
  if (kind === "crit") {
    // A bright rising arpeggio.
    [72, 76, 79, 84, 88].forEach((n, i) => pluck(ctx, out, hz(n), at + i * 0.07, 0.22));
    drum(ctx, out, at, 80, 0.45);
    return;
  }
  if (kind === "fumble") {
    // A sad trombone slide.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, at);
    osc.frequency.exponentialRampToValueAtTime(90, at + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + 1.05);
    return;
  }
  // A cinematic boom: low drop plus a burst of muffled noise.
  drum(ctx, out, at, 70, 0.6);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, 0.8);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
  src.connect(filter).connect(gain).connect(out);
  src.start(at);
}

/** The whole soundtrack as a WAV file (mono, 24 kHz). */
export async function renderSoundtrack(plan: MusicPlan): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, Math.ceil((plan.seconds + 0.5) * SAMPLE_RATE), SAMPLE_RATE);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  for (const seg of plan.segments) pad(ctx, comp, seg);
  for (const h of plan.hits) hit(ctx, comp, h);
  const rendered = await ctx.startRendering();
  return new Blob([floatToWav(rendered.getChannelData(0), SAMPLE_RATE)], { type: "audio/wav" });
}
