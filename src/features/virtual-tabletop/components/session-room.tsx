"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, CloudFog, Crown, Dices, MapPinned, MessageSquare, Music2, Pause, Play, Radio, RotateCcw, Star, Swords, UserMinus, UserPlus, Volume2, VolumeX } from "lucide-react";
import { toHexColor } from "@/lib/color";
import { usePreferencesStore } from "@/stores/preferences.store";
import { DiceTray, type TrayRoll } from "@/features/dice/components/dice-tray";
import { useRoomSounds } from "../hooks/use-room-sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { useAsync } from "@/hooks/use-async";
import { campaignService, type CampaignOverview } from "@/services/campaign.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { LogoMark } from "@/components/brand/logo";
import { rulesFor } from "@/features/combat/model/rules";
import { createInitialRoom } from "../model/room-factory";
import type { Author } from "../model/types";
import { useBotDirector } from "../hooks/use-bot-director";
import { useSheetHpWriteback } from "../hooks/use-sheet-hp-writeback";
import { useRoom, useRoomStore, type BotSpeed } from "../store/room.store";
import { useRoomSync } from "../sync/use-room-sync";
import { useTableActions } from "../sync/use-table-actions";
import { MapEditorPanel } from "@/features/map-editor/components/map-editor-panel";
import { useMapEditorStore } from "@/features/map-editor/store/map-editor.store";
import { RoomMap3D } from "./room-map-3d";
import { ChatPanel, CombatPanel, DicePanel, TokenInspector } from "./room-panels";
import { FeatureInspector, ScenePanel } from "./scene-panels";
import { PresenceBar, SyncBadge, TableNotice, TurnBanner, WaitingForTable, type VoiceBadge } from "./table-presence";
import { useVoiceChat } from "@/features/voice-chat/hooks/use-voice-chat";
import { VoiceControls } from "@/features/voice-chat/components/voice-controls";
import { AudioPanel, Equalizer, useAudibleCue } from "./audio-panel";
import { useTableAudio } from "../hooks/use-table-audio";
import { useLegacyMapImage } from "../hooks/use-legacy-map-image";
import { RoomGmPanel } from "@/features/gm/components/room-gm-panel";
import { partyOf, sessionLabelOf } from "@/features/gm/model/party";

export function SessionRoom({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const { data, status, error, reload } = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.resolve(useRoomStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  if (status === "error" && !data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!data || !hydrated) return <LoadingState label="Preparando a mesa…" className="min-h-dvh" />;
  return <Room overview={data} reloadOverview={reload} />;
}

type PanelTab = "combat" | "chat" | "dice" | "audio" | "scene" | "gm";

function Room({ overview, reloadOverview }: { overview: CampaignOverview; reloadOverview: () => Promise<void> }) {
  const user = useCurrentUser();
  const campaignId = overview.campaign.id;
  const room = useRoom(campaignId);
  const selectedId = useRoomStore((s) => s.selectedTokenId);
  const selectedFeatureId = useRoomStore((s) => s.selectedFeatureId);
  const playerPreview = useRoomStore((s) => s.playerPreview);
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
  const me = overview.members.find((m) => m.profile.id === user.id);
  const myCharacterId = me?.character?.id ?? null;
  const policy = overview.campaign.playerPolicy;

  // Who this client speaks as: the narrator for a GM, the character (or the person) for a player.
  const author: Author = useMemo(
    () =>
      isGM
        ? { id: user.id, name: overview.campaign.gameMaster.narratorName || user.displayName, color: user.avatarColor }
        : { id: user.id, name: me?.character?.name ?? user.displayName, color: me?.character?.portraitColor ?? user.avatarColor },
    [isGM, user.id, user.displayName, user.avatarColor, overview.campaign.gameMaster.narratorName, me?.character?.name, me?.character?.portraitColor],
  );

  // The table in real time (Supabase); in local mode it stays on this device.
  const sheetChanged = useRef<Parameters<typeof useRoomSync>[2]["sheetChanged"]>(() => undefined);
  const createRoom = useCallback(() => createInitialRoom(overview), [overview]);
  const sync = useRoomSync(overview, user, {
    onMembersChanged: () => void reloadOverview(),
    sheetChanged: (tokenId, data) => sheetChanged.current(tokenId, data),
    createRoom,
  });
  const runsTable = sync.mode === "local" || sync.mode === "host";
  // A player at a shared table only acts through their character (local mode keeps full controls, as before).
  const restricted = !isGM && sync.mode !== "local";
  const actions = useTableActions(campaignId, author, sync, isGM);
  useEffect(() => {
    sheetChanged.current = (tokenId, data) => actions.refreshFromSheet(tokenId, data);
  }, [actions]);

  useEffect(() => {
    if (sync.mode === "local") useRoomStore.getState().ensureRoom(campaignId, createRoom);
  }, [sync.mode, campaignId, createRoom]);

  useBotDirector(campaignId, author, runsTable);
  // Everyone hears the table (each at their own levels); old map pictures get shared.
  // While connecting (or before the first view) the room is this browser's old copy: no sound from it.
  const settled = sync.mode !== "connecting" && !(sync.mode === "guest" && !sync.hasView);
  const tableSound = useTableAudio(settled ? room?.audio : undefined);
  const nowPlaying = useAudibleCue(room?.audio?.music);
  useLegacyMapImage(campaignId, room?.map.background?.imageId, runsTable);
  useSheetHpWriteback(campaignId, user.id, runsTable);
  useRoomSounds();
  const voice = useVoiceChat(campaignId, user.id);
  const voiceBadges = useMemo(() => {
    if (voice.status !== "live") return undefined;
    const badges: Record<string, VoiceBadge> = { [user.id]: { muted: voice.muted, speaking: voice.selfSpeaking } };
    for (const p of voice.participants) badges[p.userId] = { muted: p.muted, speaking: p.speaking };
    return badges;
  }, [voice.status, voice.muted, voice.selfSpeaking, voice.participants, user.id]);
  const soundOn = usePreferencesStore((s) => s.diceSounds);
  const reduceMotion = usePreferencesStore((s) => s.reduceMotion);

  const ownTokenIds = useMemo(() => (room && myCharacterId ? room.tokens.filter((t) => t.characterId === myCharacterId).map((t) => t.id) : []), [room, myCharacterId]);

  // The latest roll this viewer may see, for the dice tray (players only receive what they may see).
  const messages = room?.messages;
  const trayRoll: TrayRoll | null = useMemo(() => {
    const m = messages?.findLast((x) => x.roll && (x.visibility === "public" || isGM || x.author.id === user.id || ownTokenIds.includes(x.author.id)));
    return m?.roll ? { id: m.id, label: m.text, author: m.author.name, color: toHexColor(m.author.color), result: m.roll } : null;
  }, [messages, isGM, user.id, ownTokenIds]);

  // The table that runs here follows the campaign system (older rooms were saved with the default rules)…
  const ruleSystem = room?.rules.systemId;
  useEffect(() => {
    if (runsTable && ruleSystem && ruleSystem !== overview.system.id) actions.setRules(rulesFor(overview.system));
  }, [runsTable, ruleSystem, overview.system, actions]);
  // …and player tokens follow their sheets, which may have changed since the room was set up.
  const ready = !!room;
  const createdAt = room?.createdAt;
  const characters = useMemo(() => overview.members.flatMap((m) => (m.character ? [{ id: m.character.id, name: m.character.name }] : [])), [overview.members]);
  useEffect(() => {
    if (ready && runsTable) void actions.syncSheets(characters);
  }, [ready, runsTable, createdAt, actions, characters]);

  const holder = sync.holderUserId ? overview.members.find((m) => m.profile.id === sync.holderUserId) : null;
  const elsewhere = isGM && sync.holderUserId === user.id;

  if (!room || (sync.mode === "guest" && !sync.hasView) || sync.mode === "connecting") {
    if (sync.mode === "guest" || elsewhere) return <WaitingForTable sync={sync} elsewhere={elsewhere} />;
    return <LoadingState label="Preparando a mesa…" className="min-h-dvh" />;
  }

  const selected = room.tokens.find((t) => t.id === selectedId) ?? null;
  const selectedFeature = room.map.props.find((p) => p.id === selectedFeatureId) ?? null;
  // Players always see the table as players; a GM can preview it (when the fog is on).
  const viewer = isGM && !(playerPreview && room.fog.enabled) ? "gm" : "player";
  const bots = room.tokens.filter((t) => t.controller === "bot");
  const hasParty = room.tokens.some((t) => t.kind !== "enemy");
  const next = overview.upcomingSessions[0];
  const canMove = restricted ? (token: { id: string }) => policy.playersCanMoveOwnToken && ownTokenIds.includes(token.id) : undefined;
  const access = !restricted ? "gm" : selected && ownTokenIds.includes(selected.id) ? "own" : "view";
  const requestCheck = actions.requestCheck;

  function startEditing() {
    if (!room) return;
    useMapEditorStore.getState().open(room.map);
    useRoomStore.getState().setFogBrush(null);
    useRoomStore.getState().selectFeature(null);
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
        <SyncBadge sync={sync} />
        {nowPlaying && (
          <button onClick={() => setTab("audio")} className="inline-flex h-7 max-w-48 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-[11px] text-fg hover:bg-accent/15" title="Tocando para a mesa">
            <Equalizer playing />
            <span className="truncate">{nowPlaying.title}</span>
          </button>
        )}
        <PresenceBar present={sync.present} voice={voiceBadges} />

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {runsTable && (
            <>
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
            </>
          )}
          {isGM && (
            <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => (editing ? stopEditing(false) : startEditing())} leadingIcon={<MapPinned className="size-3.5" />}>
              {editing ? "Sair do editor" : "Editar mapa"}
            </Button>
          )}
          {!restricted && (
            <Button size="sm" variant="secondary" onClick={() => setEpicOpen(true)} leadingIcon={<Star className="size-3.5 text-accent" />}>
              Momento épico
            </Button>
          )}
          <VoiceControls voice={voice} />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => usePreferencesStore.getState().setDiceSounds(!soundOn)}
            aria-label="Efeitos sonoros"
            title={soundOn ? "Silenciar efeitos sonoros" : "Ligar efeitos sonoros"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </Button>
          {runsTable && (
            <Button size="icon-sm" variant="ghost" onClick={() => setConfirmReset(true)} aria-label="Reiniciar cena" title="Reiniciar cena">
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      <AnimatePresence initial={false}>
        {sync.mode === "guest" && isGM && (
          <TableNotice
            key="hosted-elsewhere"
            action={
              <Button size="sm" variant="secondary" onClick={sync.takeOver} leadingIcon={<Radio className="size-3.5" />}>
                Conduzir daqui
              </Button>
            }
          >
            {holder && holder.profile.id !== user.id ? `${holder.profile.displayName} conduz a mesa.` : "A mesa é conduzida em outra aba."} Você vê tudo, e o que fizer vai para quem conduz.
          </TableNotice>
        )}
        {tableSound.locked && (
          <TableNotice
            key="sound-locked"
            action={
              <Button size="sm" onClick={tableSound.unlock} leadingIcon={<Volume2 className="size-3.5" />}>
                Ouvir
              </Button>
            }
          >
            A mesa tem música e ambiente tocando. O navegador espera um clique para liberar o som.
          </TableNotice>
        )}
        {sync.mode === "guest" && !isGM && !sync.hostOnline && (
          <TableNotice key="host-away" tone="warning">
            O mestre saiu da mesa. Você ainda vê tudo; ações voltam a valer quando ele voltar.
          </TableNotice>
        )}
      </AnimatePresence>

      {/* Map + side panel */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[52dvh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
          {!editing && <DiceTray roll={trayRoll} reduceMotion={reduceMotion} />}
          {!editing && <TurnBanner room={room} ownTokenIds={ownTokenIds} />}
          <RoomMap3D
            room={room}
            editing={editing}
            viewer={viewer}
            canMove={canMove}
            onMove={actions.moveToken}
            onFogPaint={(mode, cells) => (mode === "reveal" ? actions.revealCells(cells) : actions.hideCells(cells))}
          />
          {runsTable && !hasParty && !editing && (
            <div className="absolute inset-x-4 top-4 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-accent/40 bg-surface/95 p-3 shadow-xl backdrop-blur">
              <Bot className="size-5 shrink-0 text-accent" />
              <p className="flex-1 text-sm text-fg-muted">A mesa não tem jogadores. Adicione bots para testar a sessão.</p>
              <Button size="sm" onClick={actions.addBots}>
                Adicionar 3 bots
              </Button>
            </div>
          )}
          {restricted && ownTokenIds.length === 0 && (
            <div className="absolute inset-x-4 top-4 mx-auto max-w-md rounded-xl border border-line bg-surface/95 p-3 text-center text-sm text-fg-muted shadow-xl backdrop-blur">
              Você está assistindo. Vincule um personagem à campanha para jogar com ele aqui.
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-1 flex-col gap-3 border-t border-line bg-surface/40 p-3 lg:w-[380px] lg:flex-none lg:border-l lg:border-t-0">
          {editing ? (
            <MapEditorPanel campaignId={campaignId} onApply={() => stopEditing(true)} onCancel={() => stopEditing(false)} />
          ) : (
            <>
              {selected && (
                <TokenInspector
                  room={room}
                  token={selected}
                  actions={actions}
                  access={access}
                  onRequestCheck={restricted && requestCheck ? (request) => requestCheck(selected.id, request) : undefined}
                />
              )}
              {selectedFeature && <FeatureInspector key={`${selectedFeature.id}:${selectedFeature.trap?.damage ?? ""}`} prop={selectedFeature} actions={actions} isGM={isGM} />}
              <Tabs
                size="sm"
                value={tab}
                onChange={setTab}
                className="w-full justify-between"
                items={[
                  { value: "combat", label: <TabLabel icon={<Swords className="size-3.5" />} text="Combate" /> },
                  { value: "chat", label: <TabLabel icon={<MessageSquare className="size-3.5" />} text="Chat" />, count: room.messages.length },
                  { value: "dice", label: <TabLabel icon={<Dices className="size-3.5" />} text="Dados" /> },
                  { value: "audio", label: <TabLabel icon={<Music2 className="size-3.5" />} text="Áudio" /> },
                  ...(isGM
                    ? [
                        { value: "scene" as const, label: <TabLabel icon={<CloudFog className="size-3.5" />} text="Cena" /> },
                        { value: "gm" as const, label: <TabLabel icon={<Crown className="size-3.5" />} text="Mestre" /> },
                      ]
                    : []),
                ]}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "combat" && <CombatPanel room={room} actions={actions} canRun={!restricted} ownTokenIds={ownTokenIds} />}
                {tab === "chat" && <ChatPanel room={room} actions={actions} mineIds={[user.id, ...ownTokenIds]} isGM={!restricted} allowPrivate={policy.allowPrivateMessages} />}
                {tab === "dice" && <DicePanel actions={actions} />}
                {tab === "audio" && <AudioPanel room={room} actions={actions} campaignId={campaignId} isGM={!restricted} userId={user.id} />}
                {tab === "scene" && isGM && <ScenePanel room={room} actions={actions} />}
                {tab === "gm" && isGM && <RoomGmPanel room={room} actions={actions} party={partyOf(overview)} sessionLabel={sessionLabelOf(overview)} />}
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal
        open={epicOpen}
        onClose={() => setEpicOpen(false)}
        title="Marcar momento épico"
        description="Fica registrado no diário da campanha. O Chronicles Studio usa esses momentos para montar os episódios."
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
