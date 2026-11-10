"use client";

import { useEffect } from "react";
import { Mic, MicOff, PhoneOff, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toast.store";
import type { VoiceChat } from "../hooks/use-voice-chat";

/** The room's voice button: join, mute, hang up. */
export function VoiceControls({ voice }: { voice: VoiceChat }) {
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
