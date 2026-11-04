"use client";

import { useState } from "react";
import { Plus, Swords, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { cn } from "@/lib/cn";
import type { Encounter, EncounterEntry } from "@/types/gm";
import { DIFFICULTY_LABEL, encounterDifficulty, type Difficulty } from "../model/encounter";
import type { GmTools } from "../hooks/use-gm-tools";

export const DIFFICULTY_TONE: Record<Difficulty, "neutral" | "success" | "info" | "warning" | "danger"> = {
  trivial: "neutral",
  easy: "success",
  medium: "info",
  hard: "warning",
  deadly: "danger",
};

/** Encounters: groups of NPCs with a difficulty estimate for the party. */
export function EncounterEditor({ tools, party, guard, onDirty }: { tools: GmTools; party: { players: number; level: number }; guard: (go: () => void) => void; onDirty: (dirty: boolean) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(tools.encounters[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const selected = tools.encounters.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-2 p-3">
        <Button
          onClick={() =>
            guard(() => {
              setCreating(true);
              setSelectedId(null);
            })
          }
          leadingIcon={<Plus className="size-4" />}
          disabled={tools.npcs.length === 0}
          title={tools.npcs.length === 0 ? "Crie um NPC antes" : undefined}
        >
          Novo encontro
        </Button>
        <ul className="flex flex-col gap-1" aria-label="Encontros">
          {tools.encounters.map((e) => {
            const d = encounterDifficulty(e, tools.npcs, party.players, party.level);
            return (
              <li key={e.id}>
                <button
                  onClick={() =>
                    e.id !== selectedId &&
                    guard(() => {
                      setCreating(false);
                      setSelectedId(e.id);
                    })
                  }
                  aria-current={e.id === selectedId}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors", e.id === selectedId ? "bg-accent/12" : "hover:bg-surface-2")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.name}</span>
                    <span className="block text-xs text-fg-subtle">{e.entries.reduce((n, x) => n + x.count, 0)} criatura(s)</span>
                  </span>
                  <Badge tone={DIFFICULTY_TONE[d.difficulty]}>{DIFFICULTY_LABEL[d.difficulty]}</Badge>
                </button>
              </li>
            );
          })}
          {tools.encounters.length === 0 && <li className="px-2 py-6 text-center text-sm text-fg-subtle">Nenhum encontro ainda.</li>}
        </ul>
      </Card>

      {creating || selected ? (
        <EncounterForm
          key={selected?.id ?? "new"}
          initial={selected}
          tools={tools}
          party={party}
          onDirty={onDirty}
          onSaved={(e) => {
            onDirty(false);
            setCreating(false);
            setSelectedId(e.id);
          }}
          onDeleted={() => {
            onDirty(false);
            setSelectedId(null);
          }}
        />
      ) : (
        <Card className="p-6">
          <EmptyState
            icon={<Swords />}
            title={tools.npcs.length ? "Escolha ou monte um encontro" : "Primeiro, crie NPCs"}
            description="Um encontro junta NPCs (hostis entram como inimigos). Na mesa, “Rodar” põe todos no mapa de uma vez."
          />
        </Card>
      )}
    </div>
  );
}

function EncounterForm({
  initial,
  tools,
  party,
  onSaved,
  onDeleted,
  onDirty,
}: {
  initial: Encounter | null;
  tools: GmTools;
  party: { players: number; level: number };
  onSaved: (e: Encounter) => void;
  onDeleted: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [name, setNameRaw] = useState(initial?.name ?? "");
  const [description, setDescriptionRaw] = useState(initial?.description ?? "");
  const [entries, setEntriesRaw] = useState<EncounterEntry[]>(initial?.entries ?? [{ npcId: tools.npcs.find((n) => n.attitude === "hostile")?.id ?? tools.npcs[0]?.id ?? "", count: 1 }]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const edited = <T,>(setter: (v: T) => void) => (v: T) => {
    onDirty(true);
    setter(v);
  };
  const setName = edited(setNameRaw);
  const setDescription = edited(setDescriptionRaw);
  const setEntries = edited(setEntriesRaw);
  const d = encounterDifficulty({ entries }, tools.npcs, party.players, party.level);
  const valid = name.trim() && entries.some((e) => e.npcId) && entries.every((e) => e.count >= 1);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Emboscada na ponte" />
      <Textarea label="Notas" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={400} optional hint="Táticas, gatilhos, o que acontece se fugirem." />

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Criaturas</h3>
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-2">
              <select
                value={entry.npcId}
                onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, npcId: e.target.value } : x)))}
                aria-label={`Criatura ${i + 1}`}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-2 text-sm outline-none focus:border-accent/60"
              >
                {tools.npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                    {n.attitude === "hostile" ? "" : n.attitude === "ally" ? " (aliado)" : " (neutro)"}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={20}
                value={entry.count}
                onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, count: Math.min(20, Math.max(0, Math.round(Number(e.target.value) || 0))) } : x)))}
                onBlur={() => entries[i].count < 1 && setEntries(entries.map((x, j) => (j === i ? { ...x, count: 1 } : x)))}
                aria-label={`Quantidade de criatura ${i + 1}`}
                className="h-9 w-16 rounded-lg border border-line bg-surface-2/60 px-2 font-mono text-sm outline-none focus:border-accent/60"
              />
              <Button size="icon" variant="ghost" onClick={() => setEntries(entries.filter((_, j) => j !== i))} aria-label={`Remover criatura ${i + 1}`} disabled={entries.length === 1}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEntries([...entries, { npcId: tools.npcs[0]?.id ?? "", count: 1 }])} leadingIcon={<Plus className="size-3.5" />}>
          Adicionar criatura
        </Button>
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
        <Badge tone={DIFFICULTY_TONE[d.difficulty]}>{DIFFICULTY_LABEL[d.difficulty]}</Badge>
        <span className="text-fg-muted">
          para {party.players} personagem(ns) de nível {party.level}
        </span>
        <span className="text-xs text-fg-subtle">Estimativa: táticas, terreno e sorte pesam mais.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          loading={saving}
          disabled={!valid}
          onClick={async () => {
            setSaving(true);
            const saved = await tools.saveEncounter({ id: initial?.id, name, description, entries });
            setSaving(false);
            if (saved) onSaved(saved);
          }}
        >
          {initial ? "Salvar encontro" : "Criar encontro"}
        </Button>
        {initial &&
          (confirmDelete ? (
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                if (await tools.removeEncounter(initial.id)) onDeleted();
                else setDeleting(false);
              }}
            >
              Confirmar exclusão
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} leadingIcon={<Trash2 className="size-4" />}>
              Excluir
            </Button>
          ))}
      </div>
    </Card>
  );
}
