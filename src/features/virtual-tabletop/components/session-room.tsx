"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Dices, MapPinned, MessageSquare, Mic, Pause, Play, RotateCcw, Star, Swords, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, PhaseBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { useAsync } from "@/hooks/use-async";
import { campaignService, type CampaignOverview } from "@/services/campaign.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { LogoMark } from "@/components/brand/logo";
import { createInitialRoom } from "../model/room-factory";
import type { Author } from "../model/types";
import { useBotDirector } from "../hooks/use-bot-director";
import { useRoomActions } from "../hooks/use-room-actions";
import { useRoom, useRoomStore, type BotSpeed } from "../store/room.store";
import { MapEditorPanel } from "@/features/map-editor/components/map-editor-panel";
import { useMapEditorStore } from "@/features/map-editor/store/map-editor.store";
import { RoomMap3D } from "./room-map-3d";
import { ChatPanel, CombatPanel, DicePanel, TokenInspector } from "./room-panels";

export function SessionRoom({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.resolve(useRoomStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated && data) useRoomStore.getState().ensureRoom(campaignId, () => createInitialRoom(data));
  }, [hydrated, data, campaignId]);

  if (status === "error" && !data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!data || !hydrated) return <LoadingState label="Preparando a mesa…" className="min-h-dvh" />;
  return <Room overview={data} />;
}

type PanelTab = "combat" | "chat" | "dice";

function Room({ overview }: { overview: CampaignOverview }) {
  const user = useCurrentUser();
  const campaignId = overview.campaign.id;
  const room = useRoom(campaignId);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const running = useRoomStore((s) => s.botsRunning);
  const speed = useRoomStore((s) => s.botSpeed);
  const autoEnemies = useRoomStore((s) => s.autoEnemies);
  const { setBotsRunning, setBotSpeed, setAutoEnemies, resetRoom } = useRoomStore.getState();
  const [tab, setTab] = useState<PanelTab>("chat");
  const [epicOpen, setEpicOpen] = useState(false);
  const [epicText, setEpicText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [editing, setEditing] = useState(false);
  const isGM = overview.role === "game_master";

  const gm: Author = useMemo(
    () => ({ id: user.id, name: overview.role === "game_master" ? overview.campaign.gameMaster.narratorName || user.displayName : user.displayName, color: user.avatarColor }),
    [user.id, user.displayName, user.avatarColor, overview.role, overview.campaign.gameMaster.narratorName],
  );
  const actions = useRoomActions(campaignId, gm);
  useBotDirector(campaignId, gm);

  if (!room) return <LoadingState label="Preparando a mesa…" className="min-h-dvh" />;

  const selected = room.tokens.find((t) => t.id === selectedId) ?? null;
  const bots = room.tokens.filter((t) => t.controller === "bot");
  const hasParty = room.tokens.some((t) => t.kind !== "enemy");
  const next = overview.upcomingSessions[0];

  function startEditing() {
    if (!room) return;
    useMapEditorStore.getState().open(room.map);
    setEditing(true);
  }
  function stopEditing(apply: boolean) {
    const draft = useMapEditorStore.getState().draft;
    if (apply && draft) actions.replaceMap(draft);
    useMapEditorStore.getState().close();
    setEditing(false);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface/80 px-3 py-2 backdrop-blur sm:px-4">
        <Link href={`/campaign/${campaignId}`} className="flex items-center gap-2 text-fg-muted hover:text-fg" aria-label="Voltar para a campanha">
          <ArrowLeft className="size-4" />
          <LogoMark className="size-6" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{overview.campaign.name}</p>
          <p className="truncate text-[11px] text-fg-subtle">{next ? `Sessão ${next.number} · ${next.title}` : "Sessão avulsa"} · {room.map.name}</p>
        </div>
        {room.combat.active && (
          <Badge tone="danger" dot>
            Combate · rodada {room.combat.round}
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/60 p-0.5">
            <span className="flex items-center gap-1 px-2 text-xs text-fg-muted">
              <Bot className="size-3.5 text-accent" /> {bots.length}
            </span>
            {bots.length === 0 ? (
              <Button size="sm" variant="ghost" onClick={actions.addBots} leadingIcon={<UserPlus className="size-3.5" />}>
                Adicionar bots
              </Button>
            ) : (
              <>
                <Button size="icon-sm" variant="ghost" onClick={() => setBotsRunning(!running)} aria-label={running ? "Pausar bots" : "Retomar bots"} title={running ? "Pausar bots" : "Retomar bots"}>
                  {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <select
                  value={speed}
                  onChange={(e) => setBotSpeed(e.target.value as BotSpeed)}
                  aria-label="Velocidade dos bots"
                  className="h-7 rounded-md bg-transparent px-1 text-xs text-fg-muted outline-none hover:text-fg"
                >
                  <option value="slow">Lento</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Rápido</option>
                </select>
                <Button size="icon-sm" variant="ghost" onClick={actions.removeBots} aria-label="Remover bots" title="Remover bots">
                  <UserMinus className="size-3.5" />
                </Button>
              </>
            )}
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 text-xs text-fg-muted hover:text-fg">
            <input type="checkbox" checked={autoEnemies} onChange={(e) => setAutoEnemies(e.target.checked)} className="accent-[var(--color-accent-solid)]" />
            Inimigos automáticos
          </label>
          {isGM && (
            <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => (editing ? stopEditing(false) : startEditing())} leadingIcon={<MapPinned className="size-3.5" />}>
              {editing ? "Sair do editor" : "Editar mapa"}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEpicOpen(true)} leadingIcon={<Star className="size-3.5 text-accent" />}>
            Momento épico
          </Button>
          <span className="hidden items-center gap-1 lg:flex" title="Voz em tempo real — Fase 4">
            <Button size="icon-sm" variant="ghost" disabled aria-label="Voz (Fase 4)">
              <Mic className="size-3.5" />
            </Button>
            <PhaseBadge phase={4} />
          </span>
          <Button size="icon-sm" variant="ghost" onClick={() => setConfirmReset(true)} aria-label="Reiniciar cena" title="Reiniciar cena">
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Map + side panel */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[52dvh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
          <RoomMap3D room={room} editing={editing} onMove={actions.moveToken} />
          {!hasParty && !editing && (
            <div className="absolute inset-x-4 top-4 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-accent/40 bg-surface/95 p-3 shadow-xl backdrop-blur">
              <Bot className="size-5 shrink-0 text-accent" />
              <p className="flex-1 text-sm text-fg-muted">A mesa não tem jogadores. Adicione bots para testar a sessão.</p>
              <Button size="sm" onClick={actions.addBots}>
                Adicionar 3 bots
              </Button>
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-1 flex-col gap-3 border-t border-line bg-surface/40 p-3 lg:w-[380px] lg:flex-none lg:border-l lg:border-t-0">
          {editing ? (
            <MapEditorPanel onApply={() => stopEditing(true)} onCancel={() => stopEditing(false)} />
          ) : (
          <>
          {selected && <TokenInspector room={room} token={selected} actions={actions} />}
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            className="w-full justify-between"
            items={[
              { value: "combat", label: <TabLabel icon={<Swords className="size-3.5" />} text="Combate" /> },
              { value: "chat", label: <TabLabel icon={<MessageSquare className="size-3.5" />} text="Chat" />, count: room.messages.length },
              { value: "dice", label: <TabLabel icon={<Dices className="size-3.5" />} text="Dados" /> },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "combat" && <CombatPanel room={room} actions={actions} />}
            {tab === "chat" && <ChatPanel room={room} actions={actions} gmId={gm.id} />}
            {tab === "dice" && <DicePanel actions={actions} />}
          </div>
          </>
          )}
        </aside>
      </div>

      <Modal
        open={epicOpen}
        onClose={() => setEpicOpen(false)}
        title="Marcar momento épico"
        description="Fica registrado no log da sessão. O Chronicles Studio (Fase 6) usa esses momentos para montar o episódio."
        size="sm"
        footer={
          <Button
            onClick={() => {
              actions.markEpic(epicText);
              setEpicText("");
              setEpicOpen(false);
            }}
            leadingIcon={<Star className="size-4" />}
          >
            Marcar
          </Button>
        }
      >
        <Input label="O que aconteceu?" placeholder="Kira roubou a joia debaixo do nariz do guardião." value={epicText} onChange={(e) => setEpicText(e.target.value)} autoFocus />
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reiniciar a cena?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetRoom(campaignId, () => createInitialRoom(overview));
                setConfirmReset(false);
              }}
            >
              Reiniciar
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">Tokens, PV, chat e combate voltam ao início. Os bots saem da mesa.</p>
      </Modal>
    </div>
  );
}

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}
