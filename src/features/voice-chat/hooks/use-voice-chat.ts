"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { repositories } from "@/repositories";
import type { VoiceLink } from "@/repositories/contracts";
import { VoiceMesh, type VoicePeer } from "../model/voice-mesh";

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
}

/** STUN finds a route through most home routers; a TURN server relays the rest (optional, see .env.example). */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) servers.push({ urls: turn.split(",").map((u) => u.trim()), username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL });
  return servers;
}

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhum microfone encontrado. Conecte um e tente de novo.";
  if (name === "NotReadableError" || name === "AbortError") return "O microfone está ocupado por outro programa. Feche-o e tente de novo.";
  return "Não deu para ligar o microfone.";
}

const SPEAKING_LEVEL = 0.035;
const LEVEL_EVERY_MS = 120;
/** Keeps the "speaking" ring on through short pauses between words. */
const SPEAKING_HOLD_MS = 450;

/** Watches the loudness of audio streams and says who is talking. */
class SpeakingMeter {
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

interface Session {
  mesh: VoiceMesh;
  link: VoiceLink;
  mic: MediaStream;
  meter: SpeakingMeter;
  players: Map<string, HTMLAudioElement>;
  timer: ReturnType<typeof setInterval>;
  muted: boolean;
  /** The signalling channel let us in at least once. */
  joined: boolean;
}

const SELF = "\u0000self";

/**
 * Voice chat for the members of a campaign: a WebRTC call with each other
 * member in the channel, set up through the campaign's signalling channel.
 */
export function useVoiceChat(campaignId: string, userId: string): VoiceChat {
  const repo = repositories().voice;
  const [status, setStatus] = useState<VoiceStatus>(repo ? "idle" : "unavailable");
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);

  const leave = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    clearInterval(s.timer);
    s.mesh.stop();
    // A moment for the goodbye to go out before the channel closes.
    setTimeout(() => s.link.close(), 300);
    for (const track of s.mic.getTracks()) track.stop();
    for (const audio of s.players.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    s.meter.close();
    setPeers([]);
    setSpeaking(new Set());
    setMuted(false);
    setReconnecting(false);
    setStatus(repo ? "idle" : "unavailable");
  }, [repo]);

  const join = useCallback(async () => {
    if (!repo || session.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("A voz precisa de uma conexão segura (HTTPS). Abra o site pelo endereço https://.");
      return;
    }
    setStatus("joining");
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) {
      setError(micError(e));
      setStatus("idle");
      return;
    }

    const meter = new SpeakingMeter();
    meter.watch(SELF, mic);
    const players = new Map<string, HTMLAudioElement>();
    const mesh = new VoiceMesh({
      selfId: userId,
      localStream: mic,
      send: (envelope) => link.send(envelope),
      createPeer: () => new RTCPeerConnection({ iceServers: iceServers() }),
      onRemoteStream: (id, stream) => {
        const old = players.get(id);
        if (old) {
          old.pause();
          old.srcObject = null;
          players.delete(id);
        }
        meter.unwatch(id);
        if (!stream) return;
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = stream;
        void audio.play().catch(() => undefined);
        players.set(id, audio);
        meter.watch(id, stream);
      },
      onChange: () => setPeers(mesh.list()),
    });
    const link = repo.connect(
      campaignId,
      (envelope) => void mesh.handle(envelope),
      (state) => {
        const s = session.current;
        if (s?.mesh !== mesh) return;
        if (state === "connected") {
          s.joined = true;
          setReconnecting(false);
          setStatus("live");
          mesh.start();
        } else if (!s.joined) {
          // Never got in: not a member, or the voice migration isn't applied to the database.
          setError("Não deu para entrar no canal de voz da mesa. Tente de novo em instantes.");
          leave();
        } else setReconnecting(true);
      },
    );
    const timer = setInterval(() => {
      const now = performance.now();
      setSpeaking((prev) => {
        const next = meter.speaking(now);
        return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
      });
    }, LEVEL_EVERY_MS);
    session.current = { mesh, link, mic, meter, players, timer, muted: false, joined: false };
  }, [repo, campaignId, userId, leave]);

  const toggleMute = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.muted = !s.muted;
    s.mesh.setMuted(s.muted);
    setMuted(s.muted);
  }, []);

  // Leaving the room (or the page) hangs up.
  useEffect(() => {
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [leave]);

  return {
    status,
    reconnecting,
    muted,
    selfSpeaking: !muted && speaking.has(SELF),
    participants: peers.map((p) => ({ ...p, speaking: !p.muted && speaking.has(p.userId) })),
    error,
    join,
    leave,
    toggleMute,
  };
}
