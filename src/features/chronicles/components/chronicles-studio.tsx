"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clapperboard, DoorOpen, Film, PenLine, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { chroniclesService } from "@/services/chronicles.service";
import { toast } from "@/stores/toast.store";
import type { ChronicleEpisode, ChronicleMoment } from "@/types/chronicle";
import type { JournalKind } from "@/types/gm";
import { groupBySession, JOURNAL_KIND_LABEL } from "@/features/gm/model/journal";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { episodeSeconds } from "../model/script";
import { EpisodeEditor } from "./episode-editor";

const WRITING = ["Afiando a pena do bardo…", "Escolhendo os ângulos de câmera…", "Desenhando os balões…", "Contando os 20 naturais…", "Escrevendo o gancho do próximo episódio…"];

/**
 * Chronicles Studio: the campaign's best moments (from the journal) become
 * episodes — a script, illustrated panels and a video.
 */
export function ChroniclesStudio({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const studio = useAsync(() => chroniclesService.loadStudio(campaignId, user), [campaignId, user.id]);
  const [episodes, setEpisodes] = useState<ChronicleEpisode[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = episodes ?? studio.data?.episodes ?? [];
  const open = list.find((e) => e.id === openId) ?? null;

  if (studio.status === "error" && !studio.data) {
    return (
      <PageContainer>
        <ErrorState error={studio.error} onRetry={studio.reload} />
      </PageContainer>
    );
  }
  if (!studio.data) return <LoadingState label="Abrindo o estúdio…" />;
  const data = studio.data;
  const showPicker = creating || (!open && list.length === 0);

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {data.overview.campaign.name}
      </Link>
      <PageHeader
        eyebrow="Chronicles Studio"
        title="Episódios da campanha"
        description="Os melhores momentos das sessões viram um episódio: roteiro, quadros ilustrados e vídeo."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={data.ai.script ? "success" : "neutral"} dot>
              Roteiro: {data.ai.script ? "Claude" : "exemplo"}
            </Badge>
            <Badge tone={data.ai.images ? "success" : "neutral"} dot>
              Imagens: {data.ai.images ? "Gemini" : "exemplo"}
            </Badge>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2">
          <Button onClick={() => { setCreating(true); setOpenId(null); }} leadingIcon={<Plus className="size-4" />}>
            Novo episódio
          </Button>
          <ul className="flex flex-col gap-1.5">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => { setOpenId(e.id); setCreating(false); }}
                  className={cn("w-full rounded-xl border p-3 text-left transition-colors", e.id === openId ? "border-accent/60 bg-accent/10" : "border-line hover:bg-surface-2/60")}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Film className="size-3.5 text-accent" /> <span className="truncate">{e.title}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {e.script ? `${e.script.scenes.length} cenas · ${episodeSeconds(e.script)} s · ` : ""}
                    {formatRelative(e.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!data.ai.script || !data.ai.images ? (
            <p className="mt-2 rounded-lg border border-line bg-surface-2/40 p-3 text-xs text-fg-subtle">
              Sem {!data.ai.script && "ANTHROPIC_API_KEY"}
              {!data.ai.script && !data.ai.images && " e "}
              {!data.ai.images && "GEMINI_API_KEY"} no .env.local o estúdio usa roteiro e imagens de exemplo. Tudo o resto funciona igual.
            </p>
          ) : null}
        </aside>

        <main className="min-w-0">
          {/* Entry animation only: switching never waits for an exit to finish. */}
          {showPicker ? (
              <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <MomentPicker
                  campaignId={campaignId}
                  moments={data.moments}
                  highlightIds={data.highlightIds}
                  onWrite={async (moments, direction) => {
                    const { script, demo } = await chroniclesService.writeScript(data, moments, direction);
                    const episode = await chroniclesService.createEpisode(campaignId, user, moments.map((m) => m.id), script);
                    setEpisodes([episode, ...list]);
                    setOpenId(episode.id);
                    setCreating(false);
                    if (demo) toast.info("Roteiro de exemplo", "Configure ANTHROPIC_API_KEY no .env.local para o Claude escrever o episódio.");
                    else toast.success("Roteiro pronto", script.title);
                  }}
                />
              </motion.div>
            ) : open ? (
              <motion.div key={open.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <EpisodeEditor
                  episode={open}
                  campaignName={data.overview.campaign.name}
                  imagesLive={data.ai.images}
                  onChange={(e) => setEpisodes(list.map((x) => (x.id === e.id ? e : x)))}
                  onDelete={async () => {
                    try {
                      await chroniclesService.removeEpisode(open.id);
                      setEpisodes(list.filter((x) => x.id !== open.id));
                      setOpenId(null);
                      toast.success("Episódio apagado");
                    } catch (err) {
                      toast.error("Não deu para apagar", toUserMessage(err));
                    }
                  }}
                />
              </motion.div>
            ) : (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState icon={<Clapperboard />} title="Escolha um episódio" description="Ou crie um novo a partir dos melhores momentos da campanha." />
              </motion.div>
            )}
        </main>
      </div>
    </PageContainer>
  );
}

function MomentPicker({ campaignId, moments, highlightIds, onWrite }: { campaignId: string; moments: ChronicleMoment[]; highlightIds: string[]; onWrite: (moments: ChronicleMoment[], direction: string) => Promise<void> }) {
  const [chosen, setChosen] = useState(() => new Set(highlightIds));
  const [direction, setDirection] = useState("");
  const [writing, setWriting] = useState(false);
  const [line, setLine] = useState(0);
  const groups = useMemo(() => groupBySession(moments), [moments]);

  useEffect(() => {
    if (!writing) return;
    const id = setInterval(() => setLine((l) => (l + 1) % WRITING.length), 1800);
    return () => clearInterval(id);
  }, [writing]);

  if (moments.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="Ainda não há momentos"
        description="Jogue uma sessão: críticos, quedas, vitórias, armadilhas, revelações e momentos épicos vão para o diário e aparecem aqui."
        action={
          <ButtonLink href={`/campaign/${campaignId}/session`} leadingIcon={<DoorOpen className="size-4" />}>
            Abrir a mesa
          </ButtonLink>
        }
      />
    );
  }

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  async function write() {
    setWriting(true);
    try {
      await onWrite(moments.filter((m) => chosen.has(m.id)), direction.trim());
    } catch (e) {
      toast.error("Não deu para escrever o roteiro", toUserMessage(e));
    } finally {
      setWriting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <p className="text-sm">
            <span className="font-medium">{chosen.size}</span> de {moments.length} momentos no episódio
          </p>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set(highlightIds))}>
              Melhores momentos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
        <Input label="Direção (opcional)" placeholder="Mais sombrio, foco na Isolde, terminar com suspense…" value={direction} onChange={(e) => setDirection(e.target.value)} maxLength={400} containerClassName="mt-3" />
        <Button className="mt-3 w-full" size="lg" onClick={() => void write()} disabled={chosen.size === 0 || writing} loading={writing} leadingIcon={<PenLine className="size-4" />}>
          Escrever o roteiro
        </Button>
        <AnimatePresence>
          {writing && (
            <motion.p key={line} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
              <Wand2 className="size-3.5 text-accent" /> {WRITING[line]}
            </motion.p>
          )}
        </AnimatePresence>
      </Card>

      {groups.map((g) => (
        <section key={g.session}>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{g.session}</h3>
          <ul className="flex flex-col gap-1.5">
            {g.entries.map((m) => (
              <li key={m.id}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", chosen.has(m.id) ? "border-accent/50 bg-accent/8" : "border-line hover:bg-surface-2/50")}>
                  <input type="checkbox" checked={chosen.has(m.id)} onChange={() => toggle(m.id)} className="mt-1 accent-[var(--color-accent-solid)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Badge tone={m.kind === "epic" || m.kind === "critical" ? "accent" : m.kind === "down" ? "danger" : "neutral"}>{JOURNAL_KIND_LABEL[m.kind as JournalKind] ?? m.kind}</Badge>
                      {m.private && (
                        <span title="Anotação só do mestre: entra no vídeo apenas se você marcar">
                          <Badge tone="warning">privado</Badge>
                        </span>
                      )}
                      <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-surface-3" title={`Drama ${m.score}/12`}>
                        <span className="h-full bg-accent-solid" style={{ width: `${(m.score / 12) * 100}%` }} />
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-fg-muted">{m.text}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
