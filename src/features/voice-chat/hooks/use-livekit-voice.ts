"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type LocalAudioTrack, type RemoteParticipant, type RemoteTrack } from "livekit-client";
import { repositories } from "@/repositories";
import { VoiceChanger, type VoiceEffectId } from "../model/voice-effects";
import { micError, type VoiceChat, type VoiceParticipant, type VoiceStatus } from "./voice-common";

interface Session {
  room: Room;
  mic: MediaStream;
  changer: VoiceChanger | null;
  audio: Map<string, HTMLMediaElement>;
}

/**
 * Voice through a LiveKit media server: each person sends their voice once and
 * the server forwards it, so a table of 8 or 10 doesn't need a call between
 * every pair. Same interface as the direct calls (including the GM's voices).
 */
export function useLiveKitVoiceChat(campaignId: string, userId: string, options: { voiceEffects?: boolean } = {}): VoiceChat {
  const voiceEffects = !!options.voiceEffects;
  const available = !!repositories().voice;
  const [status, setStatus] = useState<VoiceStatus>(available ? "idle" : "unavailable");
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectId>("none");
  const [monitoring, setMonitoringState] = useState(false);
  const effectRef = useRef<VoiceEffectId>("none");
  const session = useRef<Session | null>(null);

  const refresh = useCallback(() => {
    const room = session.current?.room;
    if (!room) return;
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity));
    setSelfSpeaking(speaking.has(room.localParticipant.identity));
    setParticipants(
      [...room.remoteParticipants.values()].map((p: RemoteParticipant) => ({
        userId: p.identity,
        state: "connected",
        muted: !p.isMicrophoneEnabled,
        speaking: speaking.has(p.identity) && p.isMicrophoneEnabled,
      })),
    );
  }, []);

  const leave = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    void s.room.disconnect();
    for (const track of s.mic.getTracks()) track.stop();
    s.changer?.close();
    for (const el of s.audio.values()) el.remove();
    setParticipants([]);
    setSelfSpeaking(false);
    setMuted(false);
    setMonitoringState(false);
    setReconnecting(false);
    setStatus(available ? "idle" : "unavailable");
  }, [available]);

  const join = useCallback(async () => {
    if (!available || session.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError("A voz precisa de uma conexão segura (HTTPS). Abra o site pelo endereço https://.");
    setStatus("joining");
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) {
      setError(micError(e));
      setStatus("idle");
      return;
    }
    try {
      const token = await repositories().auth.accessToken();
      const res = await fetch("/api/voice/token", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ campaignId }) });
      const body = (await res.json().catch(() => ({}))) as { url?: string; token?: string; error?: string };
      if (!res.ok || !body.url || !body.token) throw new Error(body.error ?? "Não deu para entrar no canal de voz.");

      let changer: VoiceChanger | null = null;
      if (voiceEffects) {
        try {
          changer = new VoiceChanger(mic, effectRef.current);
        } catch {
          changer = null;
        }
      }
      const outgoing = (changer?.output ?? mic).getAudioTracks()[0];
      const room = new Room({ adaptiveStream: true, dynacast: true });
      const audio = new Map<string, HTMLMediaElement>();
      session.current = { room, mic, changer, audio };

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.dataset.voice = participant.identity;
          document.body.appendChild(el);
          audio.set(participant.identity, el);
          refresh();
        })
        .on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => {
          audio.get(participant.identity)?.remove();
          audio.delete(participant.identity);
          refresh();
        })
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.Reconnecting, () => setReconnecting(true))
        .on(RoomEvent.Reconnected, () => setReconnecting(false))
        .on(RoomEvent.Disconnected, () => {
          if (session.current?.room === room) leave();
        });

      await room.connect(body.url, body.token);
      await room.localParticipant.publishTrack(outgoing, { source: Track.Source.Microphone, name: `voz-${userId}` });
      // Browsers hold audio until a click: the "Entrar na voz" click counts.
      await room.startAudio().catch(() => undefined);
      setStatus("live");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para entrar no canal de voz.");
      if (session.current) leave();
      else {
        for (const track of mic.getTracks()) track.stop();
        setStatus("idle");
      }
    }
  }, [available, campaignId, userId, voiceEffects, leave, refresh]);

  const toggleMute = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const pub = [...s.room.localParticipant.audioTrackPublications.values()][0];
    const track = pub?.track as LocalAudioTrack | undefined;
    if (!track) return;
    if (track.isMuted) void track.unmute();
    else void track.mute();
    setMuted(!track.isMuted);
  }, []);

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

  useEffect(() => {
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [leave]);

  return { status, reconnecting, muted, selfSpeaking: !muted && selfSpeaking, participants, error, join, leave, toggleMute, voiceEffect, setVoiceEffect, monitoring, setMonitoring };
}
