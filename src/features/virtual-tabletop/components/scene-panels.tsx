"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudFog, DoorClosed, DoorOpen, Eye, EyeOff, Fence, Flame, Lock, LockOpen, MapIcon, Save, Skull, StickyNote, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { isValidDamage } from "@/features/combat/model/rules";
import { MapThumbnail } from "@/features/map/components/map-thumbnail";
import { AMBIENT_LABEL, doorOf, isInteractive, PROP_BY_ID, trapOf, type Ambient, type PlacedProp } from "@/features/map/model/map-document";
import { useCampaignMaps } from "@/features/map-editor/hooks/use-campaign-maps";
import type { SavedMap } from "@/types/map";
import type { RoomActions } from "../hooks/use-room-actions";
import type { RoomState } from "../model/types";
import { useRoomStore, type FogBrush } from "../store/room.store";

/* ---------- Scene tab (GM): fog of war, doors and traps, campaign maps ---------- */

export function ScenePanel({ room, actions }: { room: RoomState; actions: RoomActions }) {
  const { fog } = room;
  const brush = useRoomStore((s) => s.fogBrush);
  const brushSize = useRoomStore((s) => s.fogBrushSize);
  const preview = useRoomStore((s) => s.playerPreview);
  const { setFogBrush, setPlayerPreview, selectFeature, setShowNotes } = useRoomStore.getState();
  const showNotes = useRoomStore((s) => s.showNotes);
  const selectedFeatureId = useRoomStore((s) => s.selectedFeatureId);
  const total = room.map.cols * room.map.rows;
  const explored = Math.round((fog.explored.length / Math.max(total, 1)) * 100);
  const features = room.map.props.filter(isInteractive);
  const ambient = room.map.ambient ?? "bright";

  return (
    <div className="flex flex-col gap-5">
      <Section title="Iluminação" icon={<Sun className="size-3.5" />}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(AMBIENT_LABEL) as Ambient[]).map((a) => (
            <Chip key={a} active={ambient === a} onClick={() => ambient !== a && actions.setAmbient(a)}>
              {AMBIENT_LABEL[a]}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-fg-subtle">
          {ambient === "bright"
            ? "Tudo iluminado: a visão só depende das paredes."
            : `${ambient === "dim" ? "Na penumbra os personagens enxergam 3 □" : "No escuro os personagens só enxergam o que está ao lado"}; além disso, só o que tochas, fogueiras e braseiros iluminam. Dê luz a um token no inspetor dele.${fog.enabled ? "" : " Ligue a névoa de guerra para a escuridão esconder o mapa dos jogadores; sem ela, é só visual."}`}
        </p>
      </Section>

      <Section title="Névoa de guerra" icon={<CloudFog className="size-3.5" />}>
        <Switch
          checked={fog.enabled}
          onChange={(enabled) => {
            actions.configureFog({ enabled });
            if (!enabled) {
              setFogBrush(null);
              setPlayerPreview(false);
            }
          }}
          label="Esconder o que o grupo não viu"
          description="Paredes, rochas e portas fechadas bloqueiam a visão dos personagens."
        />
        {fog.enabled && (
          <div className="mt-3 flex flex-col gap-3">
            <VisionSlider key={fog.vision} value={fog.vision} onCommit={(vision) => actions.configureFog({ vision })} />
            <Switch checked={preview} onChange={setPlayerPreview} label="Ver como os jogadores" description="Esconde inimigos fora da vista e armadilhas ocultas." />
            <div>
              <p className="mb-1.5 text-[11px] text-fg-subtle">Pincel do mestre</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {([null, "reveal", "hide"] as FogBrush[]).map((b) => (
                  <Chip key={b ?? "play"} active={brush === b} onClick={() => setFogBrush(b)}>
                    {b === null ? "Jogar" : b === "reveal" ? "Revelar" : "Esconder"}
                  </Chip>
                ))}
                {brush && (
                  <label className="ml-auto flex items-center gap-2 text-[11px] text-fg-subtle">
                    <input type="range" min={1} max={7} step={2} value={brushSize} onChange={(e) => setFogBrush(brush, Number(e.target.value))} className="w-20 accent-[var(--color-accent-solid)]" aria-label="Tamanho do pincel" />
                    <span className="font-mono">{brushSize}×{brushSize}</span>
                  </label>
                )}
              </div>
              {brush && <p className="mt-1.5 text-[11px] text-fg-subtle">Arraste no mapa para {brush === "reveal" ? "revelar" : "esconder"} áreas. Volte a “Jogar” para mover tokens.</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={actions.revealAll} className="flex-1">
                Revelar tudo
              </Button>
              <Button size="sm" variant="ghost" onClick={actions.hideAll} className="flex-1">
                Esconder tudo
              </Button>
            </div>
            <p className="text-[11px] text-fg-subtle">{explored}% do mapa explorado.</p>
          </div>
        )}
      </Section>

      {(room.map.notes?.length ?? 0) > 0 && (
        <Section title="Anotações do mestre" icon={<StickyNote className="size-3.5" />}>
          <Switch checked={showNotes} onChange={setShowNotes} label={`Mostrar ${room.map.notes!.length} anotação(ões) no mapa`} description="Só aparecem para o mestre, nunca na visão dos jogadores." />
        </Section>
      )}

      <Section title={`Portas, armadilhas e luzes (${features.length})`} icon={<DoorClosed className="size-3.5" />}>
        {features.length === 0 ? (
          <p className="text-xs text-fg-subtle">Nenhuma no mapa. Coloque pelo editor, em Objetos → Portas e armadilhas.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {features.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => selectFeature(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                    p.id === selectedFeatureId ? "border-line-strong bg-surface-2" : "border-transparent hover:bg-surface-2/60",
                  )}
                >
                  <FeatureIcon prop={p} />
                  <span className="min-w-0 flex-1 truncate">{PROP_BY_ID.get(p.propId)?.label}</span>
                  <span className="text-fg-subtle">{featureSummary(p)}</span>
                  <span className="font-mono text-[10px] text-fg-subtle">
                    {p.x},{p.y}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <CampaignMaps room={room} actions={actions} />
    </div>
  );
}

function CampaignMaps({ room, actions }: { room: RoomState; actions: RoomActions }) {
  const { maps, loading, save } = useCampaignMaps(room.campaignId);
  const [pending, setPending] = useState<SavedMap | null>(null);

  return (
    <Section title="Mapas da campanha" icon={<MapIcon className="size-3.5" />}>
      <Button size="sm" variant="secondary" onClick={() => void save(room.map)} leadingIcon={<Save className="size-3.5" />} className="w-full">
        Salvar o mapa da mesa
      </Button>
      {loading ? (
        <p className="mt-2 text-xs text-fg-subtle">Carregando…</p>
      ) : maps.length === 0 ? (
        <p className="mt-2 text-xs text-fg-subtle">Nenhum mapa salvo. Salve o mapa atual ou monte um no editor.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {maps.map((m) => (
            <li key={m.id}>
              <button onClick={() => setPending(m)} className="group w-full rounded-lg border border-line p-1.5 text-left hover:border-line-strong" title="Usar na mesa">
                <MapThumbnail doc={m.document} />
                <span className="mt-1 block truncate text-xs font-medium">{m.name}</span>
                <span className="block text-[10px] text-fg-subtle">
                  {m.document.cols}×{m.document.rows} · {m.id === room.map.id ? "na mesa" : formatRelative(m.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={`Usar “${pending?.name ?? ""}” na mesa?`}
        description="O mapa atual sai da mesa (salve antes se quiser guardá-lo). Tokens em lugares bloqueados vão para o espaço livre mais próximo."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pending) actions.replaceMap(structuredClone(pending.document));
                setPending(null);
              }}
            >
              Usar na mesa
            </Button>
          </>
        }
      >
        {pending && <MapThumbnail doc={pending.document} />}
      </Modal>
    </Section>
  );
}

/**
 * Vision radius. Commits on release: every committed value is an event that
 * explores the map, so scrubbing through 20 must not reveal everything.
 */
function VisionSlider({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <label className="flex items-center gap-3 text-xs text-fg-muted">
      Visão
      <input
        type="range"
        min={2}
        max={20}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="flex-1 accent-[var(--color-accent-solid)]"
        aria-label="Alcance da visão dos personagens"
      />
      <span className="w-10 text-right font-mono">{draft} □</span>
    </label>
  );
}

function featureSummary(p: PlacedProp): string {
  const door = doorOf(p);
  if (door) return door.locked ? "trancada" : door.open ? "aberta" : "fechada";
  const trap = trapOf(p);
  if (trap) return `${trap.armed ? "armada" : "desarmada"}${trap.hidden ? " · oculta" : ""}`;
  if (PROP_BY_ID.get(p.propId)?.light) return p.lit === false ? "apagada" : "acesa";
  return "";
}

function FeatureIcon({ prop, className = "size-4" }: { prop: PlacedProp; className?: string }) {
  const def = PROP_BY_ID.get(prop.propId);
  if (def?.feature === "gate") return <Fence className={cn(className, "text-fg-muted")} />;
  if (def?.feature === "door") return doorOf(prop)?.open ? <DoorOpen className={cn(className, "text-fg-muted")} /> : <DoorClosed className={cn(className, "text-fg-muted")} />;
  if (def?.light) return <Flame className={cn(className, prop.lit === false ? "text-fg-subtle" : "text-warning")} />;
  return <Skull className={cn(className, trapOf(prop)?.armed ? "text-danger" : "text-fg-subtle")} />;
}

/* ---------- Selected door / gate / trap ---------- */

export function FeatureInspector({ prop, actions, isGM }: { prop: PlacedProp; actions: RoomActions; isGM: boolean }) {
  const selectFeature = useRoomStore((s) => s.selectFeature);
  const def = PROP_BY_ID.get(prop.propId);
  const door = doorOf(prop);
  const trap = trapOf(prop);
  const [damage, setDamage] = useState(trap?.damage ?? "");
  const normalized = damage.replace(/\s+/g, "");
  const damageValid = isValidDamage(normalized);

  return (
    <AnimatePresence mode="wait">
      <motion.section key={prop.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface-2/50 p-3" aria-label={`Selecionado: ${def?.label}`}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3">
            <FeatureIcon prop={prop} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{def?.label}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {door && <Badge tone={door.open ? "success" : "neutral"}>{door.open ? "aberta" : "fechada"}</Badge>}
              {door?.locked && <Badge tone="warning">trancada</Badge>}
              {trap && <Badge tone={trap.armed ? "danger" : "neutral"}>{trap.armed ? "armada" : "desarmada"}</Badge>}
              {trap && isGM && <Badge tone={trap.hidden ? "accent" : "info"}>{trap.hidden ? "oculta" : "visível"}</Badge>}
            </div>
          </div>
          <button onClick={() => selectFeature(null)} aria-label="Fechar" className="text-fg-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        {def?.light && isGM && (
          <Button size="sm" variant={prop.lit === false ? "primary" : "secondary"} className="mt-3 w-full" onClick={() => actions.toggleLight(prop.id)} leadingIcon={<Flame className="size-3.5" />}>
            {prop.lit === false ? "Acender" : "Apagar"}
          </Button>
        )}

        {door && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => actions.toggleDoor(prop.id)} disabled={!door.open && door.locked} leadingIcon={door.open ? <DoorClosed className="size-3.5" /> : <DoorOpen className="size-3.5" />}>
              {door.open ? "Fechar" : "Abrir"}
            </Button>
            {isGM && (
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => actions.setDoorLocked(prop.id, !door.locked)} leadingIcon={door.locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}>
                {door.locked ? "Destrancar" : "Trancar"}
              </Button>
            )}
          </div>
        )}

        {trap && isGM && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-fg-subtle">
              Dano
              <input
                value={damage}
                onChange={(e) => setDamage(e.target.value)}
                onBlur={() => damageValid && normalized !== trap.damage && actions.updateTrap(prop.id, { damage: normalized })}
                aria-invalid={!damageValid}
                className={cn("h-8 w-24 rounded-md border bg-surface-2 px-2 font-mono text-sm text-fg outline-none", damageValid ? "border-line focus:border-accent/60" : "border-danger")}
              />
              <span className="text-[11px]">ignora armadura</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => actions.updateTrap(prop.id, { hidden: !trap.hidden })} leadingIcon={trap.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}>
                {trap.hidden ? "Revelar" : "Ocultar"}
              </Button>
              <Button size="sm" variant={trap.armed ? "ghost" : "primary"} className="flex-1" onClick={() => actions.updateTrap(prop.id, { armed: !trap.armed })}>
                {trap.armed ? "Desarmar" : "Armar"}
              </Button>
            </div>
            <p className="text-[11px] text-fg-subtle">Dispara uma vez quando alguém pisa ou passa por ela; depois fica visível e desarmada.</p>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  );
}

/* ---------- Bits ---------- */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors", active ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg")}
    >
      {children}
    </button>
  );
}
