"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Clapperboard, Film } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { chroniclesService } from "@/services/chronicles.service";
import { toast } from "@/stores/toast.store";
import type { ChronicleEpisode, EpisodeScript } from "@/types/chronicle";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { episodeSeconds } from "../model/script";
import { playableVoices, useObjectUrls, useSoundtrack } from "../audio/use-episode-audio";
import { useWatermark } from "../model/use-watermark";

const EpisodePlayer = dynamic(() => import("./episode-player"), { ssr: false, loading: () => <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-2" /> });
const ComicView = dynamic(() => import("./comic-view"), { ssr: false, loading: () => <LoadingState label="Montando as páginas…" /> });

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "episodio";

/**
 * The campaign's episodes as its players see them: the ones the GMs shared,
 * to watch (with music and narration) and to read or download as a comic.
 */
export function SharedEpisodes({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const shared = useAsync(() => chroniclesService.loadShared(campaignId, user), [campaignId, user.id]);
  const [openId, setOpenId] = useState<string | null>(null);

  if (shared.status === "error" && !shared.data) {
    return (
      <PageContainer>
        <ErrorState error={shared.error} onRetry={shared.reload} />
      </PageContainer>
    );
  }
  if (!shared.data) return <LoadingState label="Abrindo os episódios…" />;
  const { overview, episodes } = shared.data;
  const open = episodes.find((e) => e.id === openId) ?? episodes[0] ?? null;
  const isGM = overview.role === "game_master";

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {overview.campaign.name}
      </Link>
      <PageHeader
        eyebrow="Chronicles"
        title="Episódios da campanha"
        description="Os melhores momentos das sessões, em vídeo e em quadrinhos, compartilhados pelo mestre."
        actions={
          isGM ? (
            <ButtonLink href={`/campaign/${campaignId}/chronicles`} variant="secondary" leadingIcon={<Clapperboard className="size-4" />}>
              Abrir o estúdio
            </ButtonLink>
          ) : undefined
        }
      />
      {episodes.length === 0 || !open ? (
        <EmptyState icon={<Film />} title="Nenhum episódio por enquanto" description="Quando o mestre compartilhar um episódio da campanha, ele aparece aqui para assistir e baixar em HQ." />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ul className="flex flex-col gap-1.5">
            {episodes.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpenId(e.id)} className={cn("w-full rounded-xl border p-3 text-left transition-colors", e.id === open.id ? "border-accent/60 bg-accent/10" : "border-line hover:bg-surface-2/60")}>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Film className="size-3.5 text-accent" /> <span className="truncate">{e.title}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {e.script ? `${e.script.scenes.length} cenas · ${episodeSeconds(e.script)} s · ` : ""}
                    {formatRelative(e.publishedAt ?? e.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <main className="min-w-0">
            <EpisodeViewer key={open.id} episode={open} campaignName={overview.campaign.name} />
          </main>
        </div>
      )}
    </PageContainer>
  );
}

/** One shared episode, read-only: the video and the comic. */
function EpisodeViewer({ episode, campaignName }: { episode: ChronicleEpisode; campaignName: string }) {
  const script = episode.script as EpisodeScript;
  const watermark = useWatermark(episode.campaignId);
  const [view, setView] = useState<"video" | "comic">("video");
  const [blobs, setBlobs] = useState<Record<string, Blob> | null>(null);
  const [voiceBlobs, setVoiceBlobs] = useState<Record<string, Blob> | null>(null);
  const urls = useObjectUrls(blobs);
  const voiceUrls = useObjectUrls(voiceBlobs);
  const music = useSoundtrack(script);
  const voices = useMemo(() => playableVoices(script, episode.voices, voiceUrls), [script, episode.voices, voiceUrls]);

  useEffect(() => {
    let alive = true;
    Promise.all([chroniclesService.loadImages(episode), chroniclesService.loadVoices(episode).catch(() => ({}))])
      .then(([images, clips]) => {
        if (!alive) return;
        setBlobs(images);
        setVoiceBlobs(clips);
      })
      .catch((e) => {
        if (!alive) return;
        toast.error("Não deu para carregar as imagens", toUserMessage(e));
        setBlobs({});
        setVoiceBlobs({});
      });
    return () => {
      alive = false;
    };
  }, [episode]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{script.title}</h2>
        {script.logline && <p className="mt-1 text-sm text-fg-muted">{script.logline}</p>}
      </div>
      <Tabs items={[{ value: "video", label: "Vídeo" }, { value: "comic", label: "HQ" }]} value={view} onChange={setView} className="self-start" />
      {!blobs || !voiceBlobs ? (
        <LoadingState label="Carregando o episódio…" />
      ) : view === "video" ? (
        <EpisodePlayer script={script} images={urls} campaignName={campaignName} music={music} voices={voices} watermark={watermark} />
      ) : (
        <ComicView script={script} blobs={blobs} campaignName={campaignName} fileBase={`${slug(campaignName)}-${slug(script.title)}`} watermark={watermark} />
      )}
      <Card className="p-3 text-xs text-fg-subtle">Episódio compartilhado pelo mestre. O vídeo e a HQ são montados neste navegador; a narração sem voz gravada é lida pela voz do navegador.</Card>
    </div>
  );
}
