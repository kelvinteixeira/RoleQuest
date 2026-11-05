"use client";

/**
 * The table's mix: follows the TableAudio state (what the GM put on) and
 * this listener's own volumes. Music crossfades when the cue changes;
 * ambience layers fade in, out or to a new level. Uploaded tracks are fetched
 * and decoded once (the last two are kept: a decoded song is large).
 */
import { startAmbience, type AmbienceVoice } from "./ambience";
import { isAmbienceId, isThemeId } from "./catalog";
import { glide, startTheme, startTrack, type MusicVoice } from "./music";
import { sharedAudioContext } from "./sfx";

export interface TableAudioState {
  music: { id: string; source: "theme" | "track"; ref: string; startedAt: string; volume: number; loop: boolean } | null;
  ambience: { id: string; volume: number }[];
}

let buses: { music: GainNode; ambience: GainNode } | null = null;
/** The cue playing; `voice` is null while an uploaded track loads. */
let current: { id: string; loop: boolean; volume: number; voice: MusicVoice | null } | null = null;
const layers = new Map<string, { voice: AmbienceVoice; volume: number }>();
const decoded = new Map<string, Promise<AudioBuffer | null>>();
const DECODED_KEEP = 2;

function out(c: AudioContext) {
  if (!buses) {
    buses = { music: c.createGain(), ambience: c.createGain() };
    buses.music.connect(c.destination);
    buses.ambience.connect(c.destination);
  }
  return buses;
}

/** This listener's levels (0..1). */
export function setListenerVolumes(volumes: { music: number; ambience: number }) {
  const c = sharedAudioContext();
  if (!c) return;
  const b = out(c);
  b.music.gain.setTargetAtTime(Math.max(0, Math.min(1, volumes.music)), c.currentTime, 0.2);
  b.ambience.gain.setTargetAtTime(Math.max(0, Math.min(1, volumes.ambience)), c.currentTime, 0.2);
}

function decode(c: AudioContext, ref: string, load: (ref: string) => Promise<Blob | null>) {
  let buffer = decoded.get(ref);
  if (buffer) {
    // Most recently used goes last.
    decoded.delete(ref);
    decoded.set(ref, buffer);
    return buffer;
  }
  buffer = load(ref)
    .then((blob) => (blob ? blob.arrayBuffer() : null))
    .then((data) => (data ? c.decodeAudioData(data) : null))
    .catch(() => null);
  decoded.set(ref, buffer);
  void buffer.then((b) => !b && decoded.delete(ref));
  while (decoded.size > DECODED_KEEP) decoded.delete(decoded.keys().next().value!);
  return buffer;
}

const offsetOf = (startedAt: string) => Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000);

/**
 * Brings the speakers in line with the table: the music cue (by id) and the
 * ambience layers. `loadTrack` fetches an uploaded file by its reference.
 */
export async function applyTableAudio(state: TableAudioState, loadTrack: (ref: string) => Promise<Blob | null>) {
  const c = sharedAudioContext();
  if (!c) return;
  const b = out(c);

  // Ambience: start new layers, glide changed ones, stop the ones taken off.
  const wanted = new Map((state.ambience ?? []).filter((l) => isAmbienceId(l.id)).map((l) => [l.id, l.volume]));
  for (const [id, layer] of layers) {
    if (!wanted.has(id)) {
      layer.voice.stop();
      layers.delete(id);
    } else if (wanted.get(id) !== layer.volume) {
      glide(c, layer.voice.gain, wanted.get(id)!, 0.4);
      layer.volume = wanted.get(id)!;
    }
  }
  for (const [id, volume] of wanted) {
    if (!layers.has(id) && isAmbienceId(id)) layers.set(id, { voice: startAmbience(c, b.ambience, id, volume), volume });
  }

  // Music: a new cue crossfades; the same cue follows its volume and loop setting.
  const cue = state.music ?? null;
  if (current && cue && current.id === cue.id) {
    current.volume = cue.volume;
    current.voice?.setVolume(cue.volume);
    if (current.loop !== cue.loop) {
      current.loop = cue.loop;
      current.voice?.setLoop(cue.loop);
    }
    return;
  }
  current?.voice?.stop();
  current = null;
  if (!cue) return;
  if (cue.source === "theme") {
    if (isThemeId(cue.ref)) current = { id: cue.id, loop: cue.loop, volume: cue.volume, voice: startTheme(c, b.music, cue.ref, offsetOf(cue.startedAt), cue.volume, cue.loop) };
    return;
  }
  // This load belongs to this cue only: a later call for the same cue must not cancel it.
  const mine = { id: cue.id, loop: cue.loop, volume: cue.volume, voice: null as MusicVoice | null };
  current = mine;
  const buffer = await decode(c, cue.ref, loadTrack);
  if (current !== mine || !buffer) return;
  // The level and loop setting may have changed while it loaded.
  mine.voice = startTrack(c, b.music, buffer, offsetOf(cue.startedAt), mine.volume, mine.loop);
}

/**
 * The browser just let sound through: music scheduled while it was held back
 * would lag behind the table, so the cue restarts at the table's current point.
 */
export function restartMusic() {
  current?.voice?.stop(0.3);
  current = null;
}

/** Leaving the table: everything fades out. */
export function stopTableAudio() {
  current?.voice?.stop(0.8);
  current = null;
  for (const layer of layers.values()) layer.voice.stop(0.8);
  layers.clear();
}
