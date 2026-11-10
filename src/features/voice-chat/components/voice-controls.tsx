"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Headphones, Mic, MicOff, PhoneOff, Theater, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toast.store";
import type { VoiceChat } from "../hooks/use-voice-chat";
import { VOICE_EFFECTS } from "../model/voice-effects";

/** The room's voice button: join, mute, hang up — and, for the GM, character voices. */
export function VoiceControls({ voice, canChangeVoice = false }: { voice: VoiceChat; canChangeVoice?: boolean }) {
  const { error } = voice;
  useEffect(() => {
    if (error) toast.error("Microfone", error);
  }, [error]);

  if (voice.status === "unavailable") {
    return (
      <span title="A voz funciona na mesa online (com o Supabase configurado).">
        <Button size="icon-sm" variant="ghost" disabled aria-label="Voz indisponível no modo local">
          <Mic className="size-3.5" />
        </Button>
      </span>
    );
  }

  if (voice.status === "idle" || voice.status === "joining") {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void voice.join()}
        loading={voice.status === "joining"}
        leadingIcon={<Mic className="size-3.5" />}
        title="Entrar na conversa por voz da mesa"
      >
        Entrar na voz
      </Button>
    );
  }

  const talking = voice.participants.length;
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-success/40 bg-success/10 p-0.5">
      <Button
        size="icon-sm"
        variant={voice.muted ? "danger" : "ghost"}
        onClick={voice.toggleMute}
        aria-pressed={voice.muted}
        aria-label={voice.muted ? "Ligar microfone" : "Silenciar microfone"}
        title={voice.muted ? "Ligar microfone" : "Silenciar microfone"}
        className={cn(!voice.muted && voice.selfSpeaking && "text-success ring-2 ring-success/60")}
      >
        {voice.muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </Button>
      {canChangeVoice && <VoicePicker voice={voice} />}
      <span className="flex items-center gap-1 px-1.5 text-[11px] text-fg-muted" title={talking ? `${talking + 1} na voz` : "Só você na voz por enquanto"}>
        {voice.reconnecting ? <WifiOff className="size-3 text-warning" /> : null}
        {talking + 1} na voz
      </span>
      <Button size="icon-sm" variant="ghost" onClick={voice.leave} aria-label="Sair da voz" title="Sair da voz">
        <PhoneOff className="size-3.5" />
      </Button>
    </div>
  );
}

/** The GM's character voices: what the table hears changes at once. */
function VoicePicker({ voice }: { voice: VoiceChat }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = VOICE_EFFECTS.find((e) => e.id === voice.voiceEffect) ?? VOICE_EFFECTS[0];
  const filtered = voice.voiceEffect !== "none";

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Voz de personagem"
        leadingIcon={<Theater className="size-3.5" />}
        className={cn("h-7 px-2 text-[11px]", filtered && "bg-accent/15 text-accent")}
      >
        <span className="hidden sm:inline">{filtered ? current.label : "Voz"}</span>
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] text-fg-subtle">A mesa ouve a voz escolhida na hora. Volte para Natural para falar como mestre.</p>
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {VOICE_EFFECTS.map((e) => {
              const on = e.id === voice.voiceEffect;
              return (
                <li key={e.id}>
                  <button
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => voice.setVoiceEffect(e.id)}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left", on ? "bg-accent/12 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">{e.label}</span>
                      <span className="block truncate text-[10px] text-fg-subtle">{e.hint}</span>
                    </span>
                    {on && <Check className="size-3.5 shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => voice.setMonitoring(!voice.monitoring)}
            aria-pressed={voice.monitoring}
            className={cn("mt-1 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs", voice.monitoring ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-fg-muted hover:text-fg")}
          >
            <Headphones className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {voice.monitoring ? "Ouvindo minha voz" : "Ouvir minha voz"}
              <span className="block text-[10px] text-fg-subtle">Use fones, senão a caixa de som volta para o microfone.</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
