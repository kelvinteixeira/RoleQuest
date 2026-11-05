"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music2, Pause, Play, Repeat, Square, Trash2, Upload, Volume2, VolumeX, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { AMBIENCES, THEMES, isThemeId, type AudioTrack } from "@/features/audio-engine/catalog";
import { themeSeconds } from "@/features/audio-engine/music";
import { audioService } from "@/services/audio.service";
import { usePreferencesStore } from "@/stores/preferences.store";
import { toast } from "@/stores/toast.store";
import type { RoomActions } from "../hooks/use-room-actions";
import type { MusicCue, RoomState } from "../model/types";

/** The cue, or null once a theme played once has run out. */
export function useAudibleCue(music: MusicCue | null | undefined): MusicCue | null {
  const [endedId, setEndedId] = useState<string | null>(null);
  const length = music && !music.loop && music.source === "theme" && isThemeId(music.ref) ? themeSeconds(music.ref) : null;
  useEffect(() => {
    if (!music || length === null) return;
    const left = Date.parse(music.startedAt) + length * 1000 - Date.now();
    const timer = setTimeout(() => setEndedId(music.id), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [music, length]);
  return music && music.id !== endedId ? music : null;
}

/**
 * A range input that only reports when the drag (or key press) ends: table
 * levels travel to every player, one message per release is enough.
 */
function Range({ value, onCommit, min = 0, label, className }: { value: number; onCommit: (v: number) => void; min?: number; label: string; className?: string }) {
  // The drag in progress, tied to the value it started from: a new value from the table ends it.
  const [draft, setDraft] = useState<{ from: number; v: number } | null>(null);
  const shown = draft && draft.from === value ? draft.v : value;
  const [sent, setSent] = useState<number | null>(null);
  const commit = () => {
    // Pointer-up and blur both end a drag: send it once.
    if (draft && draft.from === value && draft.v !== value && draft.v !== sent) {
      setSent(draft.v);
      onCommit(draft.v);
    }
  };
  return (
    <input
      type="range"
      min={min}
      max={100}
      value={Math.round(shown * 100)}
      onChange={(e) => setDraft({ from: value, v: Number(e.target.value) / 100 })}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
      className={cn("h-1 accent-[var(--color-accent-solid)]", className)}
      aria-label={label}
    />
  );
}

/** Bars that dance while something plays. */
export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-3.5 items-end gap-[2px]", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-sm bg-accent"
          animate={playing ? { height: ["30%", "100%", "45%", "85%", "30%"] } : { height: "25%" }}
          transition={playing ? { duration: 0.9 + i * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 } : { duration: 0.3 }}
        />
      ))}
    </span>
  );
}

/** A labelled level. `live` sliders report every step (this listener's own levels); the others on release. */
function Slider({ label, value, onChange, icon, live }: { label: string; value: number; onChange: (v: number) => void; icon?: React.ReactNode; live?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted">
      {icon}
      <span className="w-20 shrink-0">{label}</span>
      {live ? (
        <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="h-1 flex-1 accent-[var(--color-accent-solid)]" aria-label={label} />
      ) : (
        <Range value={value} onCommit={onChange} label={label} className="flex-1" />
      )}
      <span className="w-8 text-right font-mono tabular-nums text-fg-subtle">{Math.round(value * 100)}</span>
    </label>
  );
}

/** Each listener's own levels (they never change what others hear). */
export function ListenerVolumes() {
  const prefs = usePreferencesStore();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Seu volume</p>
      <Slider label="Música" value={prefs.musicVolume} onChange={prefs.setMusicVolume} live icon={<Music2 className="size-3.5" />} />
      <Slider label="Ambiente" value={prefs.ambienceVolume} onChange={prefs.setAmbienceVolume} live icon={<Waves className="size-3.5" />} />
      <Slider label="Efeitos" value={prefs.effectsVolume} onChange={prefs.setEffectsVolume} live icon={prefs.effectsVolume === 0 ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} />
    </div>
  );
}

/**
 * The audio centre. GMs choose the music (synthesised themes or their own
 * tracks) and mix the ambience for the whole table; everyone sets their own levels.
 */
export function AudioPanel({ room, actions, campaignId, isGM, userId }: { room: RoomState; actions: RoomActions; campaignId: string; isGM: boolean; userId: string }) {
  const audio = { music: room.audio?.music ?? null, ambience: room.audio?.ambience ?? [] };
  const music = useAudibleCue(audio.music);
  const tracks = useAsync(() => audioService.list(campaignId), [campaignId]);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const layerOf = (id: string) => audio.ambience.find((l) => l.id === id);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const track = await audioService.upload(campaignId, file, { id: userId });
      await tracks.reload();
      toast.success("Faixa adicionada", track.title);
    } catch (e) {
      toast.error("Não deu para enviar a faixa", toUserMessage(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(track: AudioTrack) {
    try {
      if (music?.source === "track" && music.ref === track.ref) actions.stopMusic();
      await audioService.remove(track);
      await tracks.reload();
    } catch (e) {
      toast.error("Não deu para remover", toUserMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Now playing */}
      <div className={cn("relative overflow-hidden rounded-xl border p-3", music ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2/40")}>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-solid/20">
            {music ? <Equalizer playing className="h-5" /> : <Music2 className="size-5 text-fg-subtle" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-fg-subtle">{music ? "Tocando para a mesa" : "Sem música"}</p>
            <p className="truncate text-sm font-medium">{music?.title ?? (isGM ? "Escolha uma trilha abaixo" : "O mestre escolhe a trilha")}</p>
          </div>
          {isGM && music && (
            <div className="flex gap-1">
              <Button size="icon-sm" variant={music.loop ? "secondary" : "ghost"} onClick={() => actions.tuneMusic({ loop: !music.loop })} aria-pressed={music.loop} aria-label="Repetir" title={music.loop ? "Repetindo" : "Tocar uma vez"}>
                <Repeat className="size-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={actions.stopMusic} aria-label="Parar a música">
                <Square className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        {isGM && music && <div className="mt-3"><Slider label="Volume da mesa" value={music.volume} onChange={(volume) => actions.tuneMusic({ volume })} /></div>}
        {audio.ambience.length > 0 && (
          <p className="mt-2 text-xs text-fg-muted">Ambiente: {audio.ambience.map((l) => AMBIENCES.find((a) => a.id === l.id)?.label ?? l.id).join(" · ")}</p>
        )}
      </div>

      <ListenerVolumes />

      {isGM && (
        <>
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Trilhas</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map((t) => {
                const on = music?.source === "theme" && music.ref === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => (on ? actions.stopMusic() : actions.playMusic("theme", t.id, t.label, { loop: t.id !== "victory" }))}
                    className={cn("flex items-center gap-2 rounded-lg border p-2 text-left transition-colors", on ? "border-accent/60 bg-accent/12" : "border-line hover:bg-surface-2/60")}
                    aria-pressed={on}
                  >
                    {on ? <Pause className="size-3.5 shrink-0 text-accent" /> : <Play className="size-3.5 shrink-0 text-fg-subtle" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{t.label}</span>
                      <span className="block truncate text-[10px] text-fg-subtle">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Suas faixas</h3>
              <Button size="sm" variant="ghost" loading={uploading} onClick={() => input.current?.click()} leadingIcon={<Upload className="size-3.5" />}>
                Enviar
              </Button>
              <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
            </div>
            {(tracks.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-fg-subtle">Envie MP3, OGG ou WAV (até 25 MB). Os jogadores ouvem junto com você.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(tracks.data ?? []).map((track) => {
                  const on = music?.source === "track" && music.ref === track.ref;
                  return (
                    <li key={track.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1.5", on ? "border-accent/60 bg-accent/12" : "border-line")}>
                      <Button size="icon-sm" variant="ghost" onClick={() => (on ? actions.stopMusic() : actions.playMusic("track", track.ref, track.title))} aria-label={on ? `Parar ${track.title}` : `Tocar ${track.title}`}>
                        {on ? <Pause className="size-3.5 text-accent" /> : <Play className="size-3.5" />}
                      </Button>
                      <span className="min-w-0 flex-1 truncate text-sm">{track.title}</span>
                      {on && <Equalizer playing />}
                      <Button size="icon-sm" variant="ghost" onClick={() => void remove(track)} aria-label={`Remover ${track.title}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Ambiente</h3>
              {(music || audio.ambience.length > 0) && (
                <Button size="sm" variant="ghost" onClick={actions.silence} leadingIcon={<VolumeX className="size-3.5" />}>
                  Silêncio
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {AMBIENCES.map((a) => {
                const layer = layerOf(a.id);
                return (
                  <div key={a.id} className={cn("rounded-lg border p-2 transition-colors", layer ? "border-accent/60 bg-accent/10" : "border-line")}>
                    <button onClick={() => actions.setLayer(a.id, layer ? null : 0.6)} className="flex w-full items-center gap-2 text-left" aria-pressed={!!layer}>
                      <span className="text-lg leading-none">{a.emoji}</span>
                      <span className="flex-1 truncate text-sm">{a.label}</span>
                      {layer && <Equalizer playing />}
                    </button>
                    {layer && (
                      <Range min={5} value={layer.volume} onCommit={(volume) => actions.setLayer(a.id, volume)} label={`Volume de ${a.label}`} className="mt-2 w-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
