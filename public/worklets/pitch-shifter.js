/**
 * Pitch shifter for the GM's character voices (see
 * src/features/voice-chat/model/voice-effects.ts), run as an AudioWorklet.
 *
 * Grains of the input are resampled by `ratio` and overlap-added four deep
 * with Hann windows. Before a grain is laid down, its start is nudged (within
 * a few milliseconds) to where it best continues the grain before it — the
 * WSOLA idea — so overlapping grains reinforce each other instead of
 * cancelling. That removes the warble of a plain two-tap delay shifter.
 *
 * `GrainShifter` is plain code (no Web Audio), exported so tests can run it.
 */

const RING = 1 << 16;
const MASK = RING - 1;

export class GrainShifter {
  /**
   * @param {number} sampleRate
   * @param {number} ratio pitch ratio (0.5 = an octave down, 2 = an octave up)
   * @param {number} [grainMs] grain length; longer is smoother for low voices, shorter is tighter
   */
  constructor(sampleRate, ratio, grainMs = 36) {
    this.ratio = Math.max(0.25, Math.min(4, ratio));
    // Grain length, a multiple of four so the hop is whole.
    this.n = Math.max(64, Math.round((sampleRate * grainMs) / 4000) * 4);
    this.hop = this.n / 4;
    /** How far a grain's start may move to line up with the previous one (covers a low voice's period). */
    this.tolerance = Math.round(sampleRate * 0.007);
    // Grains are compared over 20 ms of input (every other sample): two periods of a low voice.
    this.points = Math.round(sampleRate * 0.01);
    /** Input samples one grain needs: what it reads, or what it is compared over. */
    this.span = Math.max(Math.ceil(this.n * this.ratio), this.points * 2) + 2;
    this.window = new Float32Array(this.n);
    // Four overlapping Hann windows sum to 2: halve them.
    for (let i = 0; i < this.n; i++) this.window[i] = 0.25 * (1 - Math.cos((2 * Math.PI * i) / this.n));
    this.input = new Float32Array(RING);
    this.written = 0;
    this.acc = new Float32Array(this.n);
    this.queue = new Float32Array(RING);
    this.queued = 0;
    this.played = 0;
    this.grain = 0;
    /** Where the previous grain would carry on, one hop later. */
    this.target = -1;
    this.template = new Float32Array(this.points);
  }

  /** Samples of delay between input and output. */
  get latency() {
    return this.span + 2 * this.tolerance + this.hop;
  }

  /** How well the grain starting at `p` matches the template (normalised cross-correlation). */
  score(p) {
    const { input, template, points } = this;
    let dot = 0;
    let energy = 1e-9;
    for (let i = 0, x = p; i < points; i++, x += 2) {
      const s = input[x & MASK];
      dot += s * template[i];
      energy += s * s;
    }
    return dot / Math.sqrt(energy);
  }

  /** The best start for the next grain near `nominal`. */
  align(nominal) {
    if (this.target < 0 || this.ratio === 1) return nominal;
    const { input, template, points, tolerance } = this;
    for (let i = 0, x = this.target; i < points; i++, x += 2) template[i] = input[x & MASK];
    // Coarse pass every 4 samples, then single steps around the winner.
    let best = nominal;
    let bestScore = -Infinity;
    for (let d = -tolerance; d <= tolerance; d += 4) {
      const s = this.score(nominal + d);
      if (s > bestScore) {
        bestScore = s;
        best = nominal + d;
      }
    }
    const centre = best;
    for (let d = -3; d <= 3; d++) {
      const p = centre + d;
      if (p < nominal - tolerance || p > nominal + tolerance) continue;
      const s = this.score(p);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  /**
   * Feeds `input` and fills `output` (same length); the output lags by `latency`.
   * @param {Float32Array} input
   * @param {Float32Array} output
   */
  process(input, output) {
    const { n, hop, ratio, window, acc, tolerance, span } = this;
    for (let i = 0; i < input.length; i++) this.input[(this.written + i) & MASK] = input[i];
    this.written += input.length;

    // Lay down every grain whose input has fully arrived.
    for (;;) {
      const nominal = this.grain * hop + tolerance;
      if (nominal + tolerance + span >= this.written) break;
      const start = this.align(nominal);
      for (let i = 0; i < n; i++) {
        const x = start + i * ratio;
        const x0 = Math.floor(x);
        const frac = x - x0;
        const a = this.input[x0 & MASK];
        acc[i] += window[i] * (a + (this.input[(x0 + 1) & MASK] - a) * frac);
      }
      for (let i = 0; i < hop; i++) this.queue[(this.queued + i) & MASK] = acc[i];
      this.queued += hop;
      acc.copyWithin(0, hop);
      acc.fill(0, n - hop);
      this.target = start + Math.round(hop * ratio);
      this.grain += 1;
    }

    for (let i = 0; i < output.length; i++) {
      if (this.played < this.queued) {
        output[i] = this.queue[this.played & MASK];
        this.played += 1;
      } else output[i] = 0;
    }
  }
}

// Inside an AudioWorkletGlobalScope: register the node's processor.
if (typeof registerProcessor === "function") {
  registerProcessor(
    "rq-pitch-shifter",
    class extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const { ratio = 1, grainMs = 36 } = (options && options.processorOptions) || {};
        // `sampleRate` is a global of the worklet scope.
        this.shifter = new GrainShifter(sampleRate, ratio, grainMs);
        this.silence = new Float32Array(128);
      }

      process(inputs, outputs) {
        const out = outputs[0];
        if (!out || !out[0]) return true;
        const inp = inputs[0] && inputs[0][0] ? inputs[0][0] : this.silence.length === out[0].length ? this.silence : new Float32Array(out[0].length);
        this.shifter.process(inp, out[0]);
        for (let ch = 1; ch < out.length; ch++) out[ch].set(out[0]);
        return true;
      }
    },
  );
}
