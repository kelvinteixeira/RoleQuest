"use client";

export type { VoiceChat, VoiceParticipant, VoiceStatus } from "./voice-common";
import { useCallback, useEffect, useRef, useState } from "react";
import { repositories } from "@/repositories";
import type { VoiceLink } from "@/repositories/contracts";
import { VoiceMesh, type VoicePeer } from "../model/voice-mesh";
import { LEVEL_EVERY_MS, micError, SpeakingMeter, type VoiceChat, type VoiceStatus } from "./voice-common";
import { VoiceChanger, type VoiceEffectId } from "../model/voice-effects";
import { useLiveKitVoiceChat } from "./use-livekit-voice";

/**
 * STUN finds a route through most home routers; a TURN server relays the rest.
 * Short-lived TURN credentials come from /api/voice/ice (TURN_SECRET or
 * Cloudflare TURN on the server); fixed NEXT_PUBLIC_TURN_* values still work.
 */
async function iceServers(): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) servers.push({ urls: turn.split(",").map((u) => u.trim()), username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL });
  try {
    const token = await repositories().auth.accessToken();
    if (!token) return servers;
    const res = await fetch("/api/voice/ice", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return servers;
    const { iceServers: fromServer } = (await res.json()) as { iceServers: RTCIceServer[] };
    return [...fromServer, ...servers.slice(1)];
  } catch {
    return servers;
  }
}

interface Session {
  mesh: VoiceMesh;
  link: VoiceLink;
  mic: MediaStream;
  changer: VoiceChanger | null;
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
function useMeshVoiceChat(campaignId: string, userId: string, options: { voiceEffects?: boolean } = {}): VoiceChat {
  const voiceEffects = !!options.voiceEffects;
  const repo = repositories().voice;
  const [status, setStatus] = useState<VoiceStatus>(repo ? "idle" : "unavailable");
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectId>("none");
  const [monitoring, setMonitoringState] = useState(false);
  // Read when joining: a voice picked before the call is used from the first word.
  const effectRef = useRef<VoiceEffectId>("none");

  const leave = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    clearInterval(s.timer);
    s.mesh.stop();
    // A moment for the goodbye to go out before the channel closes.
    setTimeout(() => s.link.close(), 300);
    for (const track of s.mic.getTracks()) track.stop();
    s.changer?.close();
    setMonitoringState(false);
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

    const servers = await iceServers();

    // The GM's voice goes out through the voice changer (the call keeps that one stream all along).
    let changer: VoiceChanger | null = null;
    if (voiceEffects) {
      try {
        changer = new VoiceChanger(mic, effectRef.current);
      } catch {
        changer = null;
      }
    }
    const outgoing = changer?.output ?? mic;
    const meter = new SpeakingMeter();
    meter.watch(SELF, mic);
    const players = new Map<string, HTMLAudioElement>();
    const mesh = new VoiceMesh({
      selfId: userId,
      localStream: outgoing,
      send: (envelope) => link.send(envelope),
      createPeer: () => new RTCPeerConnection({ iceServers: servers }),
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
    session.current = { mesh, link, mic, changer, meter, players, timer, muted: false, joined: false };
  }, [repo, campaignId, userId, leave, voiceEffects]);

  const setVoiceEffect = useCallback((id: VoiceEffectId) => {
    effectRef.current = id;
    setVoiceEffectState(id);
    session.current?.changer?.setEffect(id);
  }, []);

  const setMonitoring = useCallback((on: boolean) => {
    const changer = session.current?.changer;
    if (!changer) return;
    changer.setMonitor(on);
    setMonitoringState(on);
  }, []);

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
    voiceEffect,
    setVoiceEffect,
    monitoring,
    setMonitoring,
  };
}

/**
 * Voice for the table: calls straight between browsers (default), or through a
 * LiveKit media server when NEXT_PUBLIC_VOICE_PROVIDER=livekit (large tables).
 */
export const useVoiceChat = process.env.NEXT_PUBLIC_VOICE_PROVIDER === "livekit" ? useLiveKitVoiceChat : useMeshVoiceChat;
