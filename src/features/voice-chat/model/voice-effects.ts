/**
 * Character voices for the GM: the microphone runs through a Web Audio chain
 * (pitch shift, distortion, ring modulation, echo, hall) before it reaches the
 * call. The processed stream is fixed for the whole call, so switching voices
 * only rewires the chain inside it: no WebRTC renegotiation, no gap.
 */
import { hallImpulse } from "@/features/audio-engine/music";

export const VOICE_EFFECTS = [
  { id: "none", label: "Natural", hint: "Sua voz, sem filtro" },
  { id: "giant", label: "Gigante", hint: "Grave, lento e enorme" },
  { id: "goblin", label: "Goblin", hint: "Agudo e esganiçado" },
  { id: "fairy", label: "Fada", hint: "Fininha, cintilante" },
  { id: "elder", label: "Ancião", hint: "Voz trêmula de velho" },
  { id: "demon", label: "Demônio", hint: "Grave, áspero, infernal" },
  { id: "dragon", label: "Dragão", hint: "Rugido gutural num salão" },
  { id: "ghost", label: "Espectro", hint: "Etéreo, ecoando" },
  { id: "construct", label: "Constructo", hint: "Golem ou autômato metálico" },
  { id: "deity", label: "Divindade", hint: "Várias vozes num templo" },
  { id: "distant", label: "Mensagem distante", hint: "Bola de cristal, rádio arcano" },
] as const;
export type VoiceEffectId = (typeof VOICE_EFFECTS)[number]["id"];

export const isVoiceEffectId = (id: string): id is VoiceEffectId => VOICE_EFFECTS.some((e) => e.id === id);

/** Pitch ratio → the delay sweep of a delay-line pitch shifter, per grain. */
export function pitchSweep(ratio: number, grain: number): { depth: number; rising: boolean } {
  // A delay growing at rate r lowers pitch to (1 - r); shrinking raises it to (1 + r).
  return { depth: Math.abs(ratio - 1) * grain, rising: ratio < 1 };
}

/** Soft-clipping curve for a WaveShaper (`amount` 0 = clean). */
export function driveCurve(amount: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const k = Math.max(0.001, amount);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

/** The pitch shifter's AudioWorklet module (public/worklets/pitch-shifter.js). */
export const PITCH_WORKLET_URL = "/worklets/pitch-shifter.js";
const PITCH_PROCESSOR = "rq-pitch-shifter";

/** Contexts whose audio thread already has the pitch shifter. */
const withWorklet = new WeakSet<BaseAudioContext>();

/** Loads the pitch shifter into a context; false where worklets are missing or the file fails to load. */
export async function loadPitchWorklet(c: BaseAudioContext): Promise<boolean> {
  if (withWorklet.has(c)) return true;
  try {
    await c.audioWorklet.addModule(PITCH_WORKLET_URL);
    withWorklet.add(c);
    return true;
  } catch {
    return false;
  }
}

/** A rising sawtooth from -1 to 1 (`shifted`: half a period later), band-limited to 48 harmonics. */
function sawWave(c: BaseAudioContext, shifted: boolean): PeriodicWave {
  const harmonics = 48;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) imag[n] = (shifted ? -2 : 2 * (-1) ** (n + 1)) / (Math.PI * n);
  return c.createPeriodicWave(real, imag, { disableNormalization: true });
}

export type Chain ={ input: AudioNode; output: AudioNode; nodes: AudioNode[]; sources: AudioScheduledSourceNode[] };

class Builder {
  readonly nodes: AudioNode[] = [];
  readonly sources: AudioScheduledSourceNode[] = [];
  constructor(readonly c: BaseAudioContext) {}

  keep<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    if (n instanceof AudioScheduledSourceNode) this.sources.push(n);
    return n;
  }

  gain(value = 1) {
    const g = this.keep(this.c.createGain());
    g.gain.value = value;
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7, gainDb = 0) {
    const f = this.keep(this.c.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.gain.value = gainDb;
    return f;
  }

  osc(freq: number, type: OscillatorType = "sine") {
    const o = this.keep(this.c.createOscillator());
    o.type = type;
    o.frequency.value = freq;
    o.start();
    return o;
  }

  /**
   * Shifts pitch by `ratio` (0.5 = an octave down). With the worklet loaded it
   * uses aligned grains (clean, steady); otherwise two crossfading delay lines.
   */
  pitch(ratio: number, grain = 0.07): { input: AudioNode; output: AudioNode } {
    const input = this.gain();
    const output = this.gain();
    if (Math.abs(ratio - 1) < 0.01) {
      input.connect(output);
      return { input, output };
    }
    const { c } = this;
    if (withWorklet.has(c)) {
      const node = this.keep(
        new AudioWorkletNode(c, PITCH_PROCESSOR, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: "explicit",
          outputChannelCount: [1],
          processorOptions: { ratio },
        }),
      );
      input.connect(node).connect(output);
      return { input, output };
    }
    const { depth, rising } = pitchSweep(ratio, grain);
    // Sweeps and crossfades come from oscillators running in lockstep (looping
    // buffers driving AudioParams went silent for some grain lengths in Chromium).
    const at = c.currentTime + 0.02;
    const cosine = c.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true });
    for (const line of [0, 1] as const) {
      const delay = this.keep(c.createDelay(1));
      delay.delayTime.value = 0.003 + depth / 2;
      // A sawtooth (line 1 half a period behind) moves the delay through `depth` each grain.
      const saw = this.keep(c.createOscillator());
      saw.setPeriodicWave(sawWave(c, line === 1));
      saw.frequency.value = 1 / grain;
      saw.connect(this.gain(((rising ? 1 : -1) * depth) / 2)).connect(delay.delayTime);
      // Each line is faded out (raised cosine) just as its sawtooth jumps back.
      const fade = this.keep(c.createOscillator());
      fade.setPeriodicWave(cosine);
      fade.frequency.value = 1 / grain;
      const vca = this.gain(0.5);
      fade.connect(this.gain(line === 0 ? 0.5 : -0.5)).connect(vca.gain);
      input.connect(delay).connect(vca).connect(output);
      saw.start(at);
      fade.start(at);
    }
    return { input, output };
  }

  drive(amount: number) {
    const s = this.keep(this.c.createWaveShaper());
    s.curve = driveCurve(amount);
    s.oversample = "4x";
    return s;
  }

  /** Multiplies the voice by a tone (metallic, robotic). */
  ring(freq: number) {
    const vca = this.gain(0);
    const carrier = this.osc(freq);
    carrier.connect(vca.gain);
    return vca;
  }

  /** Volume wobble. */
  tremolo(rate: number, depth: number) {
    const vca = this.gain(1 - depth);
    const l = this.osc(rate);
    const d = this.gain(depth);
    l.connect(d).connect(vca.gain);
    return vca;
  }

  /** Pitch wobble, through a short modulated delay. */
  vibrato(rate: number, depthSeconds: number) {
    const delay = this.keep(this.c.createDelay(0.1));
    delay.delayTime.value = depthSeconds * 2 + 0.003;
    const l = this.osc(rate);
    const d = this.gain(depthSeconds);
    l.connect(d).connect(delay.delayTime);
    return delay;
  }

  /** Repeats that fade: caves, spirits. */
  echo(time: number, feedback: number, into: AudioNode) {
    const delay = this.keep(this.c.createDelay(2));
    delay.delayTime.value = time;
    const fb = this.gain(feedback);
    const tone = this.filter("lowpass", 2800);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(into);
    return delay;
  }

  hall(level: number, into: AudioNode) {
    const conv = this.keep(this.c.createConvolver());
    conv.buffer = hallImpulse(this.c);
    const wet = this.gain(level);
    conv.connect(wet).connect(into);
    return conv;
  }
}

/** Wires one voice. Every chain gets the input at `input` and leaves through `output`. */
export function buildVoiceEffect(c: BaseAudioContext, id: VoiceEffectId): Chain {
  const b = new Builder(c);
  const input = b.gain();
  const output = b.gain();
  const series = (...nodes: AudioNode[]) => nodes.reduce((a, n) => (a.connect(n), n));

  switch (id) {
    case "none":
      input.connect(output);
      break;
    case "giant": {
      const p = b.pitch(0.7);
      series(input, p.input);
      series(p.output, b.filter("lowshelf", 220, 0.7, 7), b.filter("lowpass", 3500), b.gain(0.6), output);
      p.output.connect(b.hall(0.15, output));
      break;
    }
    case "goblin": {
      const p = b.pitch(1.45);
      series(input, p.input);
      series(p.output, b.filter("highpass", 350), b.filter("peaking", 2600, 1.2, 5), b.drive(1.6), b.gain(0.9), output);
      break;
    }
    case "fairy": {
      const p = b.pitch(1.75, 0.05);
      series(input, p.input);
      const bright = series(p.output, b.filter("highpass", 500), b.filter("highshelf", 4000, 0.7, 4));
      bright.connect(output);
      // A shimmer: the same voice a hair detuned, plus a sparkling hall.
      series(bright, b.vibrato(0.8, 0.004), b.gain(0.5), output);
      bright.connect(b.hall(0.5, output));
      break;
    }
    case "elder": {
      const p = b.pitch(0.9);
      series(input, p.input);
      series(p.output, b.vibrato(6.5, 0.0012), b.tremolo(6.5, 0.25), b.filter("bandpass", 1300, 0.4), b.gain(1.6), output);
      break;
    }
    case "demon": {
      const low = b.pitch(0.62);
      series(input, low.input);
      const grit = series(low.output, b.filter("lowshelf", 180, 0.7, 6), b.drive(3), b.filter("lowpass", 3200), b.gain(0.7));
      grit.connect(output);
      // A whisper of the real voice keeps the words clear.
      series(input, b.filter("highpass", 900), b.gain(0.18), output);
      grit.connect(b.hall(0.3, output));
      break;
    }
    case "dragon": {
      const low = b.pitch(0.5, 0.09);
      series(input, low.input);
      const growl = series(low.output, b.tremolo(28, 0.35), b.drive(4), b.filter("lowshelf", 150, 0.7, 8), b.filter("lowpass", 2400), b.gain(0.5));
      growl.connect(output);
      growl.connect(b.hall(0.6, output));
      break;
    }
    case "ghost": {
      const p = b.pitch(1.12);
      series(input, p.input);
      const thin = series(p.output, b.filter("highpass", 450), b.tremolo(5, 0.4), b.gain(0.7));
      thin.connect(output);
      thin.connect(b.echo(0.28, 0.45, output));
      thin.connect(b.hall(0.9, output));
      break;
    }
    case "construct": {
      const metal = series(input, b.filter("bandpass", 1200, 0.6), b.ring(55), b.gain(2.2));
      metal.connect(output);
      // A tight comb: speech through a tin can.
      const comb = b.keep(c.createDelay(0.05));
      comb.delayTime.value = 0.009;
      const fb = b.gain(0.55);
      metal.connect(comb).connect(fb).connect(comb);
      comb.connect(output);
      break;
    }
    case "deity": {
      // The voice, an octave below and a fifth above at once, in a vast hall.
      const lowOct = b.pitch(0.5);
      const fifth = b.pitch(1.5);
      input.connect(output);
      series(input, lowOct.input);
      series(input, fifth.input);
      series(lowOct.output, b.gain(0.7), output);
      series(fifth.output, b.gain(0.25), output);
      const choir = b.gain(1);
      input.connect(choir);
      lowOct.output.connect(choir);
      choir.connect(b.hall(1.1, output));
      break;
    }
    case "distant": {
      const radio = series(input, b.filter("highpass", 650, 0.9), b.filter("lowpass", 2600, 0.9), b.drive(5), b.gain(0.6));
      radio.connect(output);
      radio.connect(b.echo(0.11, 0.2, output));
      break;
    }
  }
  return { input, output, nodes: b.nodes, sources: b.sources };
}

/**
 * The GM's microphone, processed. `output` is the stream to send; it stays the
 * same object for the whole call while the voice behind it changes.
 */
export class VoiceChanger {
  readonly output: MediaStream;
  private readonly ctx: AudioContext;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly destination: MediaStreamAudioDestinationNode;
  private readonly bus: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly monitor: GainNode;
  private readonly clean: AudioNode;
  private chain: Chain;
  private current: VoiceEffectId = "none";
  private closed = false;

  constructor(input: MediaStream, effect: VoiceEffectId = "none") {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.source = this.ctx.createMediaStreamSource(input);
    // Before any voice: cut rumble and breath pops, and even out the level so
    // distortion and growls respond the same to a whisper and a shout.
    const rumble = this.ctx.createBiquadFilter();
    rumble.type = "highpass";
    rumble.frequency.value = 85;
    const level = this.ctx.createDynamicsCompressor();
    level.threshold.value = -28;
    level.knee.value = 12;
    level.ratio.value = 3;
    level.attack.value = 0.005;
    level.release.value = 0.2;
    const makeup = this.ctx.createGain();
    makeup.gain.value = 1.5;
    this.source.connect(rumble).connect(level).connect(makeup);
    this.clean = makeup;
    this.destination = this.ctx.createMediaStreamDestination();
    this.bus = this.ctx.createGain();
    // A limiter after every voice: big growls and halls never clip on the way out.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    this.bus.connect(this.limiter).connect(this.destination);
    this.monitor = this.ctx.createGain();
    this.monitor.gain.value = 0;
    this.limiter.connect(this.monitor).connect(this.ctx.destination);
    this.output = this.destination.stream;
    this.chain = this.wire(effect);
    void this.ctx.resume().catch(() => undefined);
    // The better pitch shifter arrives a moment later: rebuild the voice with it.
    void loadPitchWorklet(this.ctx).then((ok) => {
      if (!ok || this.closed) return;
      const old = this.chain;
      this.chain = this.wire(this.current);
      old.output.disconnect();
      this.unwire(old);
    });
  }

  get effect(): VoiceEffectId {
    return this.current;
  }

  private wire(id: VoiceEffectId): Chain {
    const chain = buildVoiceEffect(this.ctx, id);
    // The natural voice goes out untouched; characters get the conditioned signal.
    (id === "none" ? this.source : this.clean).connect(chain.input);
    chain.output.connect(this.bus);
    this.current = id;
    return chain;
  }

  private unwire(chain: Chain) {
    for (const from of [this.source, this.clean]) {
      try {
        from.disconnect(chain.input);
      } catch {
        // Not connected to this chain.
      }
    }
    for (const s of chain.sources) {
      try {
        s.stop();
      } catch {
        // Never started.
      }
    }
    for (const n of chain.nodes) n.disconnect();
  }

  setEffect(id: VoiceEffectId) {
    if (id === this.current) return;
    const old = this.chain;
    this.chain = this.wire(id);
    // The old chain's echoes and hall tail ring out for a moment, then it goes.
    old.output.disconnect();
    setTimeout(() => this.unwire(old), 50);
    void this.ctx.resume().catch(() => undefined);
  }

  /** Hear your own processed voice (with headphones, or the speakers feed the mic). */
  setMonitor(on: boolean) {
    this.monitor.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03);
    void this.ctx.resume().catch(() => undefined);
  }

  close() {
    this.closed = true;
    this.unwire(this.chain);
    this.source.disconnect();
    void this.ctx.close().catch(() => undefined);
  }
}
