"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, EyeOff, Lock, PenLine, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Switch } from "@/components/ui/switch";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { campaignService } from "@/services/campaign.service";
import { gmService } from "@/services/gm.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { JournalEntry, JournalKind } from "@/types/gm";
import { groupBySession, JOURNAL_KIND_LABEL } from "../model/journal";

const KIND_TONE: Record<JournalKind, "neutral" | "accent" | "danger" | "warning" | "info" | "success"> = {
  combat: "danger",
  down: "danger",
  trap: "warning",
  epic: "accent",
  critical: "info",
  reveal: "success",
  map: "neutral",
  note: "neutral",
};

/**
 * Campaign journal: the timeline of what happened, grouped by session, and
 * the NPCs the party knows. Players see public entries and revealed facts;
 * the GM also writes notes (public or private) and edits the record.
 */
export function JournalView({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const data = useAsync(async () => {
    const [overview, journal, known] = await Promise.all([campaignService.getOverview(campaignId, user.id), gmService.listJournal(campaignId, user), gmService.knownNpcs(campaignId, user)]);
    return { overview, ...journal, known };
  }, [campaignId, user.id]);

  if (data.status === "error" && !data.data) {
    return (
      <PageContainer>
        <ErrorState error={data.error} onRetry={data.reload} />
      </PageContainer>
    );
  }
  if (!data.data) return <LoadingState label="Abrindo o diário…" />;
  const { overview, entries, isGM, known } = data.data;
  const current = overview.currentSession ?? overview.upcomingSessions[0];
  const defaultSession = current ? `Sessão ${current.number} · ${current.title}` : "Entre sessões";

  /** Runs a change and reloads; resolves to whether it worked (forms keep their text when it did not). */
  const act = async (action: () => Promise<unknown>, done?: string): Promise<boolean> => {
    try {
      await action();
      if (done) toast.success(done);
      await data.reload();
      return true;
    } catch (e) {
      toast.error("Não deu certo", toUserMessage(e));
      return false;
    }
  };

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-4" /> {overview.campaign.name}
      </Link>
      <PageHeader eyebrow="Diário da campanha" title="O que aconteceu até aqui" description={isGM ? "Registre os acontecimentos da mesa pela aba Mestre na sala, ou escreva aqui. Entradas privadas só você vê." : "Os acontecimentos das sessões e o que o grupo descobriu."} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {isGM && <NoteComposer defaultSession={defaultSession} onAdd={(note) => act(() => gmService.addNote(campaignId, user, note), "Entrada adicionada")} />}
          {entries.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={<BookOpen />} title="O diário está em branco" description="Os momentos marcantes da mesa aparecem aqui." />
            </Card>
          ) : (
            groupBySession(entries)
              .reverse()
              .map(({ session, entries: list }) => (
                <section key={session} aria-label={session}>
                  <h2 className="mb-3 font-display text-lg font-semibold">{session}</h2>
                  <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
                    {list.map((e) => (
                      <EntryItem key={e.id} entry={e} isGM={isGM} onUpdate={(patch) => act(() => gmService.updateEntry(campaignId, user, e.id, patch))} onRemove={() => act(() => gmService.removeEntry(campaignId, user, e.id), "Entrada removida")} />
                    ))}
                  </ol>
                </section>
              ))
          )}
        </div>

        <aside>
          <Card>
            <CardHeader title="Quem vocês conheceram" icon={<UserRound />} description={`${known.length} NPC(s)`} />
            <ul className="flex flex-col gap-3 p-5 pt-3">
              {known.length === 0 && <li className="text-sm text-fg-subtle">Ninguém ainda.</li>}
              {known.map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-3 rounded-full" style={{ background: n.portraitColor }} />
                    {n.name}
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {n.concept}
                    {n.location ? ` · ${n.location}` : ""}
                  </p>
                  {n.description && <p className="mt-1.5 text-sm text-fg-muted">{n.description}</p>}
                  {n.facts.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-sm text-fg-muted">
                      {n.facts.map((f) => (
                        <li key={f.id}>{f.text}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {isGM && <p className="px-5 pb-4 text-xs text-fg-subtle">É isto que os jogadores veem: só NPCs conhecidos e fatos revelados.</p>}
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function EntryItem({ entry, isGM, onUpdate, onRemove }: { entry: JournalEntry; isGM: boolean; onUpdate: (patch: Partial<Pick<JournalEntry, "text" | "private">>) => Promise<boolean>; onRemove: () => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <li className="relative">
      <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-canvas bg-accent" aria-hidden />
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
        <Badge tone={KIND_TONE[entry.kind]}>{JOURNAL_KIND_LABEL[entry.kind]}</Badge>
        <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
        {entry.private && (
          <span className="inline-flex items-center gap-1 text-warning">
            <Lock className="size-3" /> só o mestre
          </span>
        )}
      </div>
      {editing ? (
        <form
          className="mt-1.5 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            // Close only once saved: a failed edit keeps the text.
            if (await onUpdate({ text })) setEditing(false);
            setBusy(false);
          }}
        >
          <Textarea aria-label="Texto da entrada" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} autoFocus />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={!text.trim()} loading={busy}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setText(entry.text);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-1 text-sm">{entry.text}</p>
      )}
      {isGM && !editing && (
        <div className="mt-1 flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} leadingIcon={<PenLine className="size-3.5" />}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onUpdate({ private: !entry.private })} leadingIcon={entry.private ? <BookOpen className="size-3.5" /> : <EyeOff className="size-3.5" />}>
            {entry.private ? "Tornar pública" : "Tornar privada"}
          </Button>
          {confirmRemove ? (
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                if (!(await onRemove())) setBusy(false);
              }}
            >
              Confirmar remoção
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)} aria-label="Remover entrada" leadingIcon={<Trash2 className="size-3.5" />}>
              Remover
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function NoteComposer({ defaultSession, onAdd }: { defaultSession: string; onAdd: (note: { text: string; sessionLabel: string; private: boolean }) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [session, setSession] = useState(defaultSession);
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          // The text is cleared only once the note is saved.
          if (await onAdd({ text, sessionLabel: session, private: isPrivate })) setText("");
          setBusy(false);
        }}
      >
        <Textarea label="Nova entrada" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} placeholder="O grupo poupou o capitão; ele agora deve um favor." />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Input label="Sessão" value={session} onChange={(e) => setSession(e.target.value)} maxLength={80} />
          <Switch checked={isPrivate} onChange={setPrivate} label="Só para o mestre" />
        </div>
        <Button type="submit" loading={busy} disabled={!text.trim()} className="self-start">
          Adicionar ao diário
        </Button>
      </form>
    </Card>
  );
}
