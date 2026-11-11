import { describe, expect, it } from "vitest";
import { GrainShifter } from "../../../../public/worklets/pitch-shifter.js";

const RATE = 48000;

/** A voice-like tone: a fundamental with harmonics, fed in blocks of 128 like the audio thread does. */
function shift(ratio: number, hz: number, seconds = 1.2, grainMs?: number): Float32Array {
  const shifter = new GrainShifter(RATE, ratio, grainMs);
  const total = Math.floor(RATE * seconds);
  const out = new Float32Array(total);
  const block = new Float32Array(128);
  const res = new Float32Array(128);
  for (let at = 0; at + 128 <= total; at += 128) {
    for (let i = 0; i < 128; i++) {
      const t = (at + i) / RATE;
      block[i] = 0.5 * Math.sin(2 * Math.PI * hz * t) + 0.25 * Math.sin(2 * Math.PI * 2 * hz * t + 0.5) + 0.12 * Math.sin(2 * Math.PI * 3 * hz * t + 1.1);
    }
    shifter.process(block, res);
    out.set(res, at);
  }
  return out.subarray(Math.floor(RATE * 0.4));
}

/** Fundamental by autocorrelation. */
function pitchOf(data: Float32Array): number {
  let best = 0;
  let bestLag = 1;
  for (let lag = Math.floor(RATE / 900); lag < RATE / 50; lag++) {
    let sum = 0;
    for (let i = 0; i < 8000; i++) sum += data[i] * data[i + lag];
    if (sum > best * 1.02) {
      best = sum;
      bestLag = lag;
    }
  }
  return RATE / bestLag;
}

/** How much the loudness wobbles: deviation of the short-time level over its mean. */
function ripple(data: Float32Array): number {
  const win = Math.floor(RATE * 0.02);
  const levels: number[] = [];
  for (let at = 0; at + win <= data.length; at += win / 2) {
    let sum = 0;
    for (let i = 0; i < win; i++) sum += data[at + i] ** 2;
    levels.push(Math.sqrt(sum / win));
  }
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  return Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length) / mean;
}

const rms = (d: Float32Array) => Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);

describe("GrainShifter", () => {
  it("passes the voice through untouched at ratio 1 (only delayed)", () => {
    const out = shift(1, 180);
    expect(pitchOf(out)).toBeCloseTo(180, -1);
    expect(rms(out)).toBeCloseTo(Math.sqrt((0.5 ** 2 + 0.25 ** 2 + 0.12 ** 2) / 2), 2);
    // The measure itself wobbles ~0.03 on a steady tone (20 ms windows over a 180 Hz wave).
    expect(ripple(out)).toBeLessThan(0.04);
  });

  it.each([0.5, 0.62, 0.7, 0.9, 1.12, 1.45, 1.75])("shifts a voice by %s keeping a steady level", (ratio) => {
    for (const hz of [110, 180, 240]) {
      const out = shift(ratio, hz);
      const got = pitchOf(out);
      expect(Math.abs(got / (hz * ratio) - 1), `${hz} Hz × ${ratio} gave ${got.toFixed(1)}`).toBeLessThan(0.03);
      // The previous delay-line shifter wobbled 7–11% on these tones; aligned grains stay under 5%
      // (part of which is the measure itself, on low notes).
      expect(ripple(out), `ripple at ${hz} Hz × ${ratio}`).toBeLessThan(0.09);
      expect(rms(out)).toBeGreaterThan(0.25);
    }
  });

  it("is silent for silence and never produces NaN", () => {
    const shifter = new GrainShifter(RATE, 0.6);
    const out = new Float32Array(128);
    for (let i = 0; i < 400; i++) shifter.process(new Float32Array(128), out);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("reports a latency under a tenth of a second for every voice", () => {
    for (const ratio of [0.5, 1, 1.75]) expect(new GrainShifter(RATE, ratio).latency / RATE).toBeLessThan(0.1);
  });
});
