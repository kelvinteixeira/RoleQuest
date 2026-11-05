"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Radio, Swords, WifiOff } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { currentTurnToken } from "../model/room-engine";
import type { RoomState } from "../model/types";
import type { PresentMember, RoomSync } from "../sync/use-room-sync";

/** Who is at the table right now: avatars that pop in and out, a crown on whoever runs it. */
export function PresenceBar({ present }: { present: PresentMember[] }) {
  if (present.length === 0) return null;
  return (
    <div className="flex items-center -space-x-1.5" aria-label={`Na mesa: ${present.map((p) => p.name).join(", ")}`}>
      <AnimatePresence initial={false}>
        {present.map((p) => (
          <motion.span
            key={p.userId}
            layout
            initial={{ opacity: 0, scale: 0.4, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="relative rounded-full ring-2 ring-surface"
            title={`${p.name}${p.hosting ? " · conduz a mesa" : p.role === "game_master" ? " · mestre" : ""}`}
          >
            <Avatar name={p.name} color={p.color} src={p.avatarUrl} size="sm" />
            {p.hosting && (
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-accent">
                <Crown className="size-3 fill-current" />
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-surface" />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Connection state of a real-time table. */
export function SyncBadge({ sync }: { sync: RoomSync }) {
  if (sync.mode === "local") return null;
  const live = sync.status === "connected";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium",
        live ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning",
      )}
      title={live ? (sync.mode === "host" ? "Você conduz a mesa: todos veem o que acontece aqui." : "Conectado à mesa do mestre.") : "Reconectando…"}
    >
      {live ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
      ) : (
        <WifiOff className="size-3" />
      )}
      {live ? (sync.mode === "host" ? "Ao vivo · você conduz" : "Ao vivo") : "Reconectando…"}
    </span>
  );
}

/** A player (or a GM in another tab) waiting for the table to open. */
/** `elsewhere`: this GM already runs the table in another tab or device. */
export function WaitingForTable({ sync, elsewhere }: { sync: RoomSync; elsewhere: boolean }) {
  const sameUserElsewhere = elsewhere;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-8 text-center">
      <motion.div animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
        <LogoMark className="size-14" />
      </motion.div>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {sameUserElsewhere ? "A mesa está aberta em outra aba" : sync.hostOnline ? "Entrando na mesa…" : "Esperando o mestre"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
          {sameUserElsewhere
            ? "Você já conduz esta mesa em outra aba ou aparelho. Conduza daqui, se preferir."
            : sync.hostOnline
              ? "Buscando o mapa e os personagens."
              : "Assim que o mestre abrir a mesa, ela aparece aqui sozinha. Pode deixar esta tela aberta."}
        </p>
      </div>
      <PresenceBar present={sync.present} />
      {sameUserElsewhere && (
        <Button onClick={sync.takeOver} leadingIcon={<Radio className="size-4" />}>
          Conduzir a mesa aqui
        </Button>
      )}
    </div>
  );
}

/** Thin strip under the header for table-wide situations. */
export function TableNotice({ tone = "info", children, action }: { tone?: "info" | "warning"; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={cn("flex shrink-0 items-center gap-3 overflow-hidden border-b px-4 py-2 text-xs", tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : "border-accent/30 bg-accent/10 text-fg-muted")}
    >
      <span className="flex-1">{children}</span>
      {action}
    </motion.div>
  );
}

/** "Sua vez!" — a banner sweeps over the map at every turn of a combat. */
export function TurnBanner({ room, ownTokenIds }: { room: RoomState; ownTokenIds: string[] }) {
  const current = room.combat.active ? currentTurnToken(room) : null;
  const key = current ? `${room.combat.round}:${room.combat.turn}:${current.id}` : null;
  const [shown, setShown] = useState<{ key: string; name: string; round: number; mine: boolean; color: string } | null>(null);
  const name = current?.name ?? "";
  const color = current?.color ?? "";
  const round = room.combat.round;
  const mine = !!current && ownTokenIds.includes(current.id);

  useEffect(() => {
    if (!key) return;
    const show = setTimeout(() => setShown({ key, name, round, mine, color }), 0);
    const hide = setTimeout(() => setShown((s) => (s?.key === key ? null : s)), mine ? 2600 : 1700);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // Only a new turn shows the banner (name/colour come with it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.key}
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="pointer-events-none absolute inset-x-0 top-16 z-20 mx-auto flex w-fit flex-col items-center"
          aria-live="polite"
        >
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-canvas/80 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-fg-subtle backdrop-blur">
            <Swords className="size-3" /> Rodada {shown.round}
          </span>
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl px-6 py-2.5 font-display text-2xl font-semibold tracking-tight shadow-2xl backdrop-blur",
              shown.mine ? "bg-accent-solid/90 text-accent-fg" : "bg-canvas/85 text-fg",
            )}
            style={shown.mine ? undefined : { boxShadow: `0 0 0 2px ${shown.color}, 0 20px 40px -12px rgb(0 0 0 / 0.6)` }}
          >
            {/* A light sweep across the banner. */}
            <motion.span
              initial={{ x: "-120%" }}
              animate={{ x: "220%" }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/25"
            />
            <span className="relative">{shown.mine ? `Sua vez, ${shown.name}!` : `Vez de ${shown.name}`}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
