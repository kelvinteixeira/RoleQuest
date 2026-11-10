"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Eye, MapPinPlus, Play, Skull, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { gmService } from "@/services/gm.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { freeCellNear } from "@/features/virtual-tabletop/model/map";
import type { RoomActions } from "@/features/virtual-tabletop/hooks/use-room-actions";
import type { RoomState } from "@/features/virtual-tabletop/model/types";
import type { Npc } from "@/types/gm";
import { useGmTools } from "../hooks/use-gm-tools";
import { DIFFICULTY_LABEL, encounterDifficulty, encounterTokens } from "../model/encounter";
import { journalFromMessages, REVEAL_PREFIX } from "../model/journal";
import { ATTITUDE_LABEL, npcToken } from "../model/npc";
import { templateToken } from "../model/map-spawns";
import { MONSTER_PRESETS, TIER_LABEL, TIER_ORDER, type MonsterTier, type SpawnPreset } from "@/features/map-editor/model/spawn-presets";
import { DIFFICULTY_TONE } from "./encounter-editor";

/**
 * The GM's side of the table: put NPCs on the map, reveal what they know
 * (in the chat and in the journal), run prepared encounters and record the
 * session in the campaign journal.
 */
export function RoomGmPanel({ room, actions, party, sessionLabel }: { room: RoomState; actions: RoomActions; party: { players: number; level: number }; sessionLabel: string }) {
  const user = useCurrentUser();
  const campaignId = room.campaignId;
  const tools = useGmTools(campaignId);
  const journal = useAsync(() => gmService.listJournal(campaignId, user), [campaignId, user.id]);
  const [open, setOpen] = useState<string | null>(null);
  const [tier, setTier] = useState<MonsterTier | null>(null);
  const [rollInitiative, setRollInitiative] = useState(true);
  const [recording, setRecording] = useState(false);
  // Facts being revealed right now: a second click must not post them twice. The ref is
  // checked synchronously (two clicks can land before a re-render); state only drives the spinner.
  const inFlight = useRef(new Set<string>());
  const [revealing, setRevealing] = useState<Set<string>>(new Set());

  const recorded = new Set(journal.data?.recordedSources ?? []);
  const pending = journal.data ? journalFromMessages(room.messages, campaignId, sessionLabel, recorded) : [];

  /** Near the party's centre (or the map's), on a free square. */
  const spotNearParty = () => {
    const pcs = room.tokens.filter((t) => t.kind === "pc");
    const cx = pcs.length ? Math.round(pcs.reduce((s, t) => s + t.x, 0) / pcs.length) + 2 : Math.floor(room.map.cols / 2);
    const cy = pcs.length ? Math.round(pcs.reduce((s, t) => s + t.y, 0) / pcs.length) : Math.floor(room.map.rows / 2);
    return freeCellNear(room.map, room.tokens, { x: Math.min(cx, room.map.cols - 1), y: cy });
  };

  async function placeNpc(npc: Npc) {
    actions.addTokens([npcToken(npc, room.rules, spotNearParty())]);
    toast.success(`${npc.name} está na mesa`);
    // Met at the table: the party now knows this NPC exists.
    if (!npc.known) {
      try {
        await gmService.updateNpc(campaignId, user, npc.id, { known: true });
        tools.reload();
      } catch {
        // The token is on the table either way; the GM can mark it known in the NPC sheet.
      }
    }
  }

  function placeMonster(preset: SpawnPreset) {
    const token = templateToken(preset, room.map, room.rules, room.tokens, spotNearParty());
    actions.addTokens([token]);
    toast.success(`${token.name} está na mesa`);
  }

  async function reveal(npc: Npc, factId: string) {
    const fact = npc.facts.find((f) => f.id === factId);
    if (!fact || fact.revealed || inFlight.current.has(factId)) return;
    inFlight.current.add(factId);
    setRevealing((s) => new Set(s).add(factId));
    try {
      const updated = await tools.revealFact(npc.id, factId, true);
      if (!updated) return;
      const at = new Date().toISOString();
      const sourceId = actions.post(`${REVEAL_PREFIX}${npc.name}: ${fact.text}`);
      // Straight into the journal (not only when the GM records the session).
      await gmService.record(campaignId, user, [{ campaignId, at, sessionLabel, kind: "reveal", text: `${REVEAL_PREFIX}${npc.name}: ${fact.text}`, private: false, sourceId }]);
      await journal.reload();
    } catch (e) {
      toast.error("Não foi possível registrar a revelação", toUserMessage(e));
    } finally {
      inFlight.current.delete(factId);
      setRevealing((s) => {
        const next = new Set(s);
        next.delete(factId);
        return next;
      });
    }
  }

  async function record() {
    setRecording(true);
    try {
      const added = await gmService.record(campaignId, user, pending);
      toast.success(added.length ? `${added.length} momento(s) no diário` : "Nada novo para registrar");
      await journal.reload();
    } catch (e) {
      toast.error("Não foi possível registrar", toUserMessage(e));
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <BookOpen className="size-3.5" /> Diário · {sessionLabel}
        </h3>
        {journal.status === "error" && !journal.data ? (
          <p className="text-xs text-danger">
            Não foi possível ler o diário.{" "}
            <button className="underline" onClick={() => void journal.reload()}>
              Tentar de novo
            </button>
          </p>
        ) : (
          <Button className="w-full" variant="secondary" loading={recording || !journal.data} disabled={pending.length === 0} onClick={() => void record()}>
            {pending.length ? `Registrar ${pending.length} momento(s) no diário` : "Diário em dia"}
          </Button>
        )}
        <p className="mt-1.5 text-[11px] text-fg-subtle">
          Combates, quedas, armadilhas, revelações, momentos épicos e 20/1 naturais. Entradas removidas no diário não voltam.{" "}
          <Link href={`/campaign/${campaignId}/journal`} className="text-accent hover:underline">
            Abrir o diário
          </Link>
        </p>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <Skull className="size-3.5" /> Bestiário ({MONSTER_PRESETS.length})
        </h3>
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTier(tier === t ? null : t)}
              aria-pressed={tier === t}
              className={cn("h-7 shrink-0 rounded-full border px-2.5 text-xs", tier === t ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted")}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
        {tier ? (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
            {MONSTER_PRESETS.filter((m) => m.tier === tier).map((m) => (
              <li key={m.key} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.name}</span>
                  <span className="block truncate text-[11px] text-fg-subtle">
                    {m.stats.hp} PV · Def {m.stats.defense} · {m.stats.damage} · {m.concept}
                  </span>
                </span>
                <Button size="icon-sm" variant="ghost" onClick={() => placeMonster(m)} aria-label={`Pôr ${m.name} na mesa`} title="Pôr na mesa, perto do grupo">
                  <MapPinPlus className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fg-subtle">Escolha um tamanho para ver os monstros. Entram perto do grupo, já com ficha de combate; os grandes ocupam várias casas.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <Users className="size-3.5" /> NPCs ({tools.npcs.length})
        </h3>
        {tools.error && tools.npcs.length === 0 ? (
          <p className="text-xs text-danger">
            Não foi possível carregar os NPCs.{" "}
            <button className="underline" onClick={tools.reload}>
              Tentar de novo
            </button>
          </p>
        ) : (
          !tools.loading &&
          tools.npcs.length === 0 && (
            <p className="text-xs text-fg-subtle">
              Nenhum NPC. Crie nas{" "}
              <Link href={`/campaign/${campaignId}/gm`} className="text-accent hover:underline">
                ferramentas do mestre
              </Link>
              .
            </p>
          )
        )}
        <ul className="flex flex-col gap-1">
          {tools.npcs.map((n) => {
            const expanded = open === n.id;
            const hidden = n.facts.filter((f) => !f.revealed);
            return (
              <li key={n.id} className="rounded-lg border border-line">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button onClick={() => setOpen(expanded ? null : n.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="size-5 shrink-0 rounded-full" style={{ background: n.portraitColor }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{n.name}</span>
                      <span className="block truncate text-[11px] text-fg-subtle">
                        {ATTITUDE_LABEL[n.attitude]} · {hidden.length} segredo(s) por revelar
                      </span>
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform", expanded && "rotate-180")} />
                  </button>
                  <Button size="icon-sm" variant="ghost" onClick={() => void placeNpc(n)} aria-label={`Pôr ${n.name} na mesa`} title="Pôr na mesa">
                    <MapPinPlus className="size-4" />
                  </Button>
                </div>
                {expanded && (
                  <div className="border-t border-line px-3 py-2">
                    {n.secretNotes && <p className="mb-2 text-xs text-fg-subtle">Secreto: {n.secretNotes}</p>}
                    {n.facts.length === 0 && <p className="text-xs text-fg-subtle">Sem fatos cadastrados.</p>}
                    <ul className="flex flex-col gap-1.5">
                      {n.facts.map((f) => (
                        <li key={f.id} className="flex items-start gap-2 text-xs">
                          <span className={cn("min-w-0 flex-1", f.revealed && "text-fg-subtle line-through decoration-fg-subtle/40")}>{f.text}</span>
                          {!f.revealed && (
                            <Button size="sm" variant="secondary" loading={revealing.has(f.id)} onClick={() => void reveal(n, f.id)} aria-label={`Revelar: ${f.text}`} leadingIcon={<Eye className="size-3" />}>
                              Revelar
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <Swords className="size-3.5" /> Encontros ({tools.encounters.length})
        </h3>
        {!tools.loading && tools.encounters.length === 0 && <p className="text-xs text-fg-subtle">Nenhum encontro preparado.</p>}
        <ul className="flex flex-col gap-1">
          {tools.encounters.map((e) => {
            const d = encounterDifficulty(e, tools.npcs, party.players, party.level);
            const count = e.entries.reduce((s, x) => s + x.count, 0);
            return (
              <li key={e.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{e.name}</span>
                  <span className="block text-[11px] text-fg-subtle">{count} criatura(s)</span>
                </span>
                <Badge tone={DIFFICULTY_TONE[d.difficulty]}>{DIFFICULTY_LABEL[d.difficulty]}</Badge>
                <Button
                  size="sm"
                  disabled={count === 0}
                  aria-label={`Rodar ${e.name}`}
                  onClick={() => {
                    const tokens = encounterTokens(e, tools.npcs, room.map, room.rules, room.tokens);
                    actions.addTokens(tokens, { rollInitiative });
                    toast.success(`${e.name}: ${tokens.length} na mesa`, rollInitiative ? (room.combat.active ? "Entraram no combate em andamento." : "Iniciativa rolada.") : undefined);
                  }}
                  leadingIcon={<Play className="size-3" />}
                >
                  Rodar
                </Button>
              </li>
            );
          })}
        </ul>
        {tools.encounters.length > 0 && (
          <label className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
            <input type="checkbox" checked={rollInitiative} onChange={(e) => setRollInitiative(e.target.checked)} className="accent-[var(--color-accent-solid)]" />
            Rolar iniciativa ao rodar (entra no combate se já houver um)
          </label>
        )}
      </section>
    </div>
  );
}
