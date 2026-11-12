"use client";

/** What both voice backends share: the interface the room uses, microphone errors and the speaking meter. */
import type { VoicePeer } from "../model/voice-mesh";
import type { VoiceEffectId } from "../model/voice-effects";

export type VoiceStatus = "unavailable" | "idle" | "joining" | "live";

export interface VoiceParticipant extends VoicePeer {
  speaking: boolean;
}

export interface VoiceChat {
  status: VoiceStatus;
  /** Signalling dropped: calls already open keep going, new ones wait for it to come back. */
  reconnecting: boolean;
  muted: boolean;
  /** Is this member's voice heard right now. */
  selfSpeaking: boolean;
  /** Everyone else in the voice channel. */
  participants: VoiceParticipant[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  /** Character voice the others hear (the GM's voice filters). */
  voiceEffect: VoiceEffectId;
  setVoiceEffect: (id: VoiceEffectId) => void;
  /** Hearing your own processed voice. */
  monitoring: boolean;
  setMonitoring: (on: boolean) => void;
}

export function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhum microfone encontrado. Conecte um e tente de novo.";
  if (name === "NotReadableError" || name === "AbortError") return "O microfone está ocupado por outro programa. Feche-o e tente de novo.";
  return "Não deu para ligar o microfone.";
}

const SPEAKING_LEVEL = 0.035;
export const LEVEL_EVERY_MS = 120;
/** Keeps the "speaking" ring on through short pauses between words. */
const SPEAKING_HOLD_MS = 450;

/** Watches the loudness of audio streams and says who is talking. */
export class SpeakingMeter {
  private readonly ctx = new AudioContext();
  private readonly meters = new Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; lastLoud: number }>();
  private readonly buffer = new Uint8Array(512);

  watch(id: string, stream: MediaStream) {
    this.unwatch(id);
    if (stream.getAudioTracks().length === 0) return;
    const source = this.ctx.createMediaStreamSource(stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    this.meters.set(id, { source, analyser, lastLoud: 0 });
    void this.ctx.resume().catch(() => undefined);
  }

  unwatch(id: string) {
    const m = this.meters.get(id);
    if (!m) return;
    m.source.disconnect();
    this.meters.delete(id);
  }

  speaking(now: number): Set<string> {
    const out = new Set<string>();
    for (const [id, m] of this.meters) {
      m.analyser.getByteTimeDomainData(this.buffer);
      let sum = 0;
      for (const v of this.buffer) sum += ((v - 128) / 128) ** 2;
      if (Math.sqrt(sum / this.buffer.length) > SPEAKING_LEVEL) m.lastLoud = now;
      if (now - m.lastLoud < SPEAKING_HOLD_MS) out.add(id);
    }
    return out;
  }

  close() {
    for (const id of [...this.meters.keys()]) this.unwatch(id);
    void this.ctx.close().catch(() => undefined);
  }
}
