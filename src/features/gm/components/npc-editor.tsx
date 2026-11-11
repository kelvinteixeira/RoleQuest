"use client";

import { useState } from "react";
import { Eye, EyeOff, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/feedback/states";
import { cn } from "@/lib/cn";
import { ALL_CHARACTER_MODELS as CHARACTER_MODELS, CHARACTER_GROUP_LABEL, type CharacterModel } from "@/features/virtual-tabletop/model/character-models";
import type { NpcStatBlock } from "@/features/combat/model/types";
import type { Npc, NpcAttitude, NpcInput } from "@/types/gm";
import { ATTITUDE_LABEL, blankNpc, newFact, validateNpc } from "../model/npc";
import type { GmTools } from "../hooks/use-gm-tools";

const ATTITUDE_TONE: Record<NpcAttitude, "success" | "neutral" | "danger"> = { ally: "success", neutral: "neutral", hostile: "danger" };

/** GM's NPC list and sheet: public description, secret notes, facts to reveal, combat block. */
/**
 * `guard` runs a navigation only if there are no unsaved edits (or the GM agrees to drop them);
 * `onDirty` reports whether the open form has unsaved edits.
 */
export function NpcEditor({
  campaignId,
  tools,
  selectedId,
  onSelect,
  guard,
  onDirty,
}: {
  campaignId: string;
  tools: GmTools;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  guard: (go: () => void) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = tools.npcs.filter((n) => `${n.name} ${n.concept} ${n.location}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const selected = tools.npcs.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Input aria-label="Buscar NPC" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<Search className="size-4" />} containerClassName="flex-1" />
          <Button
            size="icon"
            onClick={() =>
              guard(() => {
                setCreating(true);
                onSelect(null);
              })
            }
            aria-label="Novo NPC"
            title="Novo NPC"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <ul className="flex flex-col gap-1" aria-label="NPCs">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                onClick={() =>
                  n.id !== selectedId &&
                  guard(() => {
                    setCreating(false);
                    onSelect(n.id);
                  })
                }
                aria-current={n.id === selectedId}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors", n.id === selectedId ? "bg-accent/12" : "hover:bg-surface-2")}
              >
                <span className="size-7 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: n.portraitColor }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.name}</span>
                  <span className="block truncate text-xs text-fg-subtle">{n.concept || "Sem conceito"}</span>
                </span>
                <Badge tone={ATTITUDE_TONE[n.attitude]}>{ATTITUDE_LABEL[n.attitude]}</Badge>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-2 py-6 text-center text-sm text-fg-subtle">{tools.npcs.length ? "Nenhum NPC com esse nome." : "Nenhum NPC ainda."}</li>}
        </ul>
      </Card>

      {creating || selected ? (
        <NpcForm
          key={selected?.id ?? "new"}
          initial={selected ?? { ...blankNpc(campaignId), id: undefined }}
          tools={tools}
          onDirty={onDirty}
          onSaved={(npc) => {
            onDirty(false);
            setCreating(false);
            onSelect(npc.id);
          }}
          onDeleted={() => {
            onDirty(false);
            onSelect(null);
          }}
        />
      ) : (
        <Card className="p-6">
          <EmptyState icon={<UserRound />} title="Escolha um NPC" description="Ou crie um novo. Cada NPC tem descrição pública, notas secretas, fatos que você revela durante a sessão e um bloco de combate que se adapta ao sistema." />
        </Card>
      )}
    </div>
  );
}

type Draft = Omit<NpcInput, "campaignId"> & { id?: string };

/** The editable fields of an NPC (no campaign id or timestamps). */
const toDraft = (n: NpcInput & { id?: string }): Draft => ({
  id: n.id,
  name: n.name,
  concept: n.concept,
  attitude: n.attitude,
  portraitColor: n.portraitColor,
  modelId: n.modelId,
  location: n.location,
  description: n.description,
  secretNotes: n.secretNotes,
  facts: n.facts,
  stats: n.stats,
  known: n.known,
});

function NpcForm({ initial, tools, onSaved, onDeleted, onDirty }: { initial: (Npc | NpcInput) & { id?: string }; tools: GmTools; onSaved: (npc: Npc) => void; onDeleted: () => void; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [fact, setFact] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameTouched, setNameTouched] = useState(!!initial.id);
  const errors = validateNpc(draft);
  const set = (patch: Partial<Draft>) => {
    onDirty(true);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setStat = (patch: Partial<NpcStatBlock>) => {
    onDirty(true);
    setDraft((d) => ({ ...d, stats: { ...d.stats, ...patch } }));
  };

  async function save() {
    setSaving(true);
    const { id, ...input } = draft;
    const saved = await tools.saveNpc(input, id);
    setSaving(false);
    if (saved) onSaved(saved);
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome" value={draft.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => setNameTouched(true)} error={nameTouched ? errors.name : undefined} maxLength={60} />
        <Input label="Conceito" hint="Visível ao grupo quando o conhecer." value={draft.concept} onChange={(e) => set({ concept: e.target.value })} placeholder="Taverneira, guarda corrupto…" maxLength={80} />
        <Select label="Atitude" value={draft.attitude} onChange={(e) => set({ attitude: e.target.value as NpcAttitude })}>
          {(Object.keys(ATTITUDE_LABEL) as NpcAttitude[]).map((a) => (
            <option key={a} value={a}>
              {ATTITUDE_LABEL[a]}
              {a === "hostile" ? " (entra como inimigo)" : ""}
            </option>
          ))}
        </Select>
        <Input label="Onde encontrar" hint="Visível ao grupo." value={draft.location} onChange={(e) => set({ location: e.target.value })} optional maxLength={80} />
      </div>

      <Textarea label="Descrição pública" hint="O que o grupo sabe quando conhece o NPC." value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={400} />
      <Textarea label="Notas secretas" hint="Só você vê." value={draft.secretNotes} onChange={(e) => set({ secretNotes: e.target.value })} rows={2} maxLength={600} />
      <Switch checked={draft.known} onChange={(known) => set({ known })} label="O grupo conhece este NPC" description="Aparece no diário dos jogadores com a descrição e os fatos revelados." />

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Fatos a revelar</h3>
        <ul className="flex flex-col gap-1.5">
          {draft.facts.map((f) => (
            <li key={f.id} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", f.revealed ? "border-success/40 bg-success/5" : "border-line")}>
              <span className="min-w-0 flex-1">{f.text}</span>
              <button
                onClick={() => set({ facts: draft.facts.map((x) => (x.id === f.id ? { ...x, revealed: !x.revealed, revealedAt: !x.revealed ? new Date().toISOString() : undefined } : x)), known: !f.revealed ? true : draft.known })}
                aria-pressed={f.revealed}
                aria-label={f.revealed ? `Esconder: ${f.text}` : `Revelar: ${f.text}`}
                title={f.revealed ? "Revelado ao grupo (clique para esconder)" : "Oculto (clique para revelar)"}
                className={f.revealed ? "text-success" : "text-fg-subtle hover:text-fg"}
              >
                {f.revealed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button onClick={() => set({ facts: draft.facts.filter((x) => x.id !== f.id) })} aria-label={`Remover fato: ${f.text}`} className="text-fg-subtle hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fact.trim()) return;
            set({ facts: [...draft.facts, newFact(fact)] });
            setFact("");
          }}
        >
          <Input aria-label="Novo fato" placeholder="Ex.: guarda um mapa do subsolo atrás do balcão" value={fact} onChange={(e) => setFact(e.target.value)} containerClassName="flex-1" maxLength={240} />
          <Button type="submit" variant="secondary" disabled={!fact.trim()}>
            Adicionar
          </Button>
        </form>
        <p className="mt-1.5 text-xs text-fg-subtle">Na mesa, revelar um fato posta no chat e registra no diário.</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Combate (escrito em d20; a mesa converte para o sistema)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="PV" value={draft.stats.hp} onChange={(hp) => setStat({ hp })} error={errors.hp} />
          <Num label="Defesa" value={draft.stats.defense} onChange={(defense) => setStat({ defense })} error={errors.defense} />
          <Num label="Bônus de ataque" value={draft.stats.attackBonus} onChange={(attackBonus) => setStat({ attackBonus })} error={errors.attackBonus} />
          <Input label="Dano" value={draft.stats.damage} onChange={(e) => setStat({ damage: e.target.value })} error={errors.damage} className="font-mono" />
          <Num label="Deslocamento" value={draft.stats.speed} onChange={(speed) => setStat({ speed })} error={errors.speed} />
          <Num label="Iniciativa" value={draft.stats.initiativeBonus} onChange={(initiativeBonus) => setStat({ initiativeBonus })} error={errors.initiativeBonus} />
          <Num label="Alcance (□)" value={draft.stats.range ?? 1} onChange={(range) => setStat({ range })} error={errors.range} />
          <Input label="Nome do ataque" value={draft.stats.attackName ?? ""} onChange={(e) => setStat({ attackName: e.target.value })} maxLength={40} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
          Aparência na mesa
          <select
            value={draft.modelId ?? ""}
            onChange={(e) => set({ modelId: e.target.value || undefined })}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-accent/60 sm:max-w-60"
          >
            <option value="">Automática (pelo conceito)</option>
            {(Object.keys(CHARACTER_GROUP_LABEL) as CharacterModel["group"][]).map((group) => (
              <optgroup key={group} label={CHARACTER_GROUP_LABEL[group]}>
                {CHARACTER_MODELS.filter((m) => m.group === group).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button onClick={() => void save()} loading={saving} disabled={Object.keys(errors).length > 0} title={Object.values(errors)[0]}>
          {draft.id ? "Salvar NPC" : "Criar NPC"}
        </Button>
        {Object.keys(errors).length > 0 && <span className="text-xs text-fg-subtle">{Object.values(errors)[0]}</span>}
        {draft.id &&
          (confirmDelete ? (
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                if (await tools.removeNpc(draft.id!)) onDeleted();
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

/**
 * Number field that keeps what is typed ("-", empty) instead of snapping to 0;
 * an incomplete value reaches the form as NaN, which validation rejects.
 */
function Num({ label, value, onChange, error }: { label: string; value: number; onChange: (v: number) => void; error?: string }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  return (
    <Input
      label={label}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        setText(raw);
        onChange(raw.trim() === "" || raw === "-" ? NaN : Number(raw));
      }}
      error={error}
      className="font-mono"
    />
  );
}
