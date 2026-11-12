"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, Clapperboard, Download, ImagePlus, Loader2, Mic, Palette, RefreshCw, Save, Share2, Trash2, Users, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { LoadingState } from "@/components/feedback/states";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { chroniclesService, type IllustrationStep, type NarrationStep } from "@/services/chronicles.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { ChronicleEpisode, EpisodeScene, EpisodeScript } from "@/types/chronicle";
import { episodeSeconds, SCENE_SECONDS_MAX, sceneImageKey } from "../model/script";
import { playableVoices, useObjectUrls, useSoundtrack } from "../audio/use-episode-audio";
import { EpisodeVideo, FPS, HEIGHT, WIDTH, episodeFrames } from "../video/episode-video";
import { useWatermark } from "../model/use-watermark";

const EpisodePlayer = dynamic(() => import("./episode-player"), { ssr: false, loading: () => <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-2" /> });

const ComicView = dynamic(() => import("./comic-view"), { ssr: false, loading: () => <LoadingState label="Montando as páginas…" /> });

const KIND_LABEL: Record<EpisodeScene["kind"], string> = { title: "Abertura", scene: "Cena", roll: "Rolagem", end: "Encerramento" };

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "episodio";

/**
 * One episode: watch it, edit the script scene by scene, illustrate it
 * (Gemini, or stand-ins) and export the video (rendered in this browser).
 */
export function EpisodeEditor({ episode: initial, campaignName, imagesLive, voiceLive, onChange, onDelete }: { episode: ChronicleEpisode; campaignName: string; imagesLive: boolean; voiceLive: boolean; onChange: (e: ChronicleEpisode) => void; onDelete: () => void }) {
  const user = useCurrentUser();
  const [episode, setEpisode] = useState(initial);
  const watermark = useWatermark(initial.campaignId);
  const [script, setScript] = useState<EpisodeScript>(initial.script!);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blobs, setBlobs] = useState<Record<string, Blob> | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<IllustrationStep[] | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<"video" | "comic">("video");
  const [voiceBlobs, setVoiceBlobs] = useState<Record<string, Blob>>({});
  const [narration, setNarration] = useState<NarrationStep[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const music = useSoundtrack(script);
  const voiceUrls = useObjectUrls(voiceBlobs);
  const voices = useMemo(() => playableVoices(script, episode.voices, voiceUrls), [script, episode.voices, voiceUrls]);
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);
  // One object URL per image, kept while the image is the same (no reload of every picture on each step).
  const urlCache = useRef(new Map<string, { blob: Blob; url: string }>());
  const loaded = useRef(false);

  const applyImages = useCallback((next: Record<string, Blob>) => {
    const cache = urlCache.current;
    let changed = cache.size !== Object.keys(next).length;
    for (const [key, entry] of cache) {
      if (next[key] === entry.blob) continue;
      URL.revokeObjectURL(entry.url);
      cache.delete(key);
      changed = true;
    }
    for (const [key, blob] of Object.entries(next)) {
      if (cache.has(key)) continue;
      cache.set(key, { blob, url: URL.createObjectURL(blob) });
      changed = true;
    }
    // The first load always lands (an episode without images yet is loaded too).
    if (!changed && loaded.current) return;
    loaded.current = true;
    setBlobs({ ...next });
    setUrls(Object.fromEntries([...cache].map(([key, entry]) => [key, entry.url])));
  }, []);

  // Images load once per episode (the editor is remounted for another one); saving doesn't reload them.
  const episodeId = initial.id;
  useEffect(() => {
    let alive = true;
    chroniclesService
      .loadImages(initial)
      .then((b) => alive && applyImages(b))
      .catch((e) => alive && toast.error("Não deu para carregar as imagens", toUserMessage(e)));
    chroniclesService
      .loadVoices(initial)
      .then((v) => alive && setVoiceBlobs(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // `initial` is read once for this episode id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, applyImages]);

  // Leaving the editor stops a running illustration and releases the image URLs.
  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      abort.current?.abort();
      for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
      cache.clear();
    };
  }, []);

  function edit(next: EpisodeScript) {
    setScript(next);
    setDirty(true);
  }
  function editScene(id: string, patch: Partial<EpisodeScene>) {
    edit({ ...script, scenes: script.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function moveScene(index: number, by: -1 | 1) {
    const scenes = [...script.scenes];
    const [scene] = scenes.splice(index, 1);
    scenes.splice(index + by, 0, scene);
    edit({ ...script, scenes });
  }

  async function save(): Promise<ChronicleEpisode | null> {
    setSaving(true);
    try {
      const saved = await chroniclesService.saveScript(episode, script);
      setEpisode(saved);
      onChange(saved);
      setDirty(false);
      return saved;
    } catch (e) {
      toast.error("Não deu para salvar", toUserMessage(e));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function illustrate(only?: string[]) {
    // One run at a time (a double click must not pay twice).
    if (running.current || !blobs) return;
    running.current = true;
    let keepSteps = false;
    try {
      const base = dirty ? await save() : episode;
      if (!base) return;
      const controller = new AbortController();
      abort.current = controller;
      const { episode: done, demo, aborted, failed } = await chroniclesService.illustrate(
        { ...base, script },
        blobs,
        (s, e, b) => {
          setSteps(s);
          setEpisode(e);
          applyImages(b);
        },
        { only, signal: controller.signal },
      );
      setEpisode(done);
      onChange(done);
      keepSteps = failed > 0;
      if (aborted) toast.info("Ilustração parada", "O que já foi desenhado ficou salvo.");
      else if (failed) toast.error(`${failed} imagem(ns) não saíram`, "Veja o motivo na lista e tente de novo.");
      else if (demo) toast.info("Imagens de exemplo", "Configure GEMINI_API_KEY no .env.local para ilustrar de verdade.");
      else toast.success(only ? "Quadro redesenhado" : "Episódio ilustrado");
    } catch (e) {
      toast.error("Não deu para ilustrar", toUserMessage(e));
    } finally {
      running.current = false;
      abort.current = null;
      // Errors stay on screen until the next run.
      if (!keepSteps) setTimeout(() => setSteps((s) => (s?.some((x) => x.status === "error") ? s : null)), 1500);
    }
  }

  async function recordNarration() {
    if (running.current) return;
    running.current = true;
    try {
      const base = dirty ? await save() : episode;
      if (!base) return;
      const controller = new AbortController();
      abort.current = controller;
      const { episode: done, missingKey, failed } = await chroniclesService.recordNarration(
        { ...base, script },
        (s, e, clips) => {
          setNarration(s);
          setEpisode(e);
          if (Object.keys(clips).length) setVoiceBlobs((v) => ({ ...v, ...clips }));
        },
        controller.signal,
      );
      setEpisode(done);
      // Scenes may have grown to fit their narration.
      if (done.script) setScript(done.script);
      onChange(done);
      if (missingKey) toast.info("Narração do navegador", "Sem GEMINI_API_KEY a prévia lê os recordatórios com a voz do navegador (o MP4 sai só com a trilha).");
      else if (failed) toast.error(`${failed} narração(ões) não saíram`, "Veja o motivo na lista e tente de novo.");
      else toast.success("Narração gravada", "Ela entra na prévia e no MP4.");
    } catch (e) {
      toast.error("Não deu para gravar a narração", toUserMessage(e));
    } finally {
      running.current = false;
      abort.current = null;
      setTimeout(() => setNarration((s) => (s?.some((x) => x.status === "error") ? s : null)), 1500);
    }
  }

  async function toggleShared() {
    setSharing(true);
    try {
      const base = dirty ? await save() : episode;
      if (!base) return;
      const next = await chroniclesService.setShared(base, user, !base.publishedAt);
      setEpisode(next);
      onChange(next);
      if (next.publishedAt) toast.success("Compartilhado com os jogadores", "Eles assistem ao vídeo e à HQ na página da campanha. Novas edições salvas aparecem para eles.");
      else toast.info("Episódio só para os mestres", "Os jogadores não veem mais este episódio.");
    } catch (e) {
      toast.error("Não deu para mudar o compartilhamento", toUserMessage(e));
    } finally {
      setSharing(false);
    }
  }

  async function exportVideo() {
    if (typeof window === "undefined" || !("VideoEncoder" in window)) {
      toast.error("Navegador sem suporte", "A exportação usa WebCodecs: abra no Chrome ou Edge atualizados.");
      return;
    }
    setExporting(0);
    try {
      const { renderMediaOnWeb } = await import("@remotion/web-renderer");
      const props = { script, images: urls, campaignName, music, voices, watermark };
      const result = await renderMediaOnWeb({
        composition: { id: "episode", component: EpisodeVideo, durationInFrames: episodeFrames(script), fps: FPS, width: WIDTH, height: HEIGHT, defaultProps: props },
        inputProps: props,
        // A tab in the background loads images slowly: give each one time instead of failing at ~30 s.
        delayRenderTimeoutInMilliseconds: 120_000,
        onProgress: ({ progress }) => setExporting(progress),
      });
      const blob = await result.getBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(campaignName)}-${slug(script.title)}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      toast.success("Vídeo exportado", a.download);
    } catch (e) {
      console.error("Chronicles: exportação", e);
      const message = e instanceof Error ? e.message : "";
      if (/delayRender|timeout/i.test(message)) toast.error("A exportação travou", "Deixe esta aba visível (em primeiro plano) enquanto o vídeo é montado e tente de novo.");
      // Other render errors come from the browser (codecs, memory): their own message says more than a generic one.
      else toast.error("Não deu para exportar", message ? message.slice(0, 200) : toUserMessage(e));
    } finally {
      setExporting(null);
    }
  }

  const missing = script.scenes.filter((s) => !blobs?.[sceneImageKey(s)]).length;
  const unvoiced = script.scenes.filter((s) => s.narration.trim() && !voices[s.id]).length;
  const busy = (!!steps && steps.some((s) => s.status === "drawing" || s.status === "pending")) || (!!narration && narration.some((s) => s.status === "recording" || s.status === "pending")) || exporting !== null || saving || sharing;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Título do episódio" value={script.title} onChange={(e) => edit({ ...script, title: e.target.value })} containerClassName="min-w-60 flex-1" maxLength={120} />
        <Button variant="secondary" onClick={() => void save()} loading={saving} disabled={!dirty || busy} leadingIcon={<Save className="size-4" />}>
          {dirty ? "Salvar" : "Salvo"}
        </Button>
        <Button
          variant={episode.publishedAt ? "secondary" : "ghost"}
          onClick={() => void toggleShared()}
          loading={sharing}
          disabled={busy && !sharing}
          leadingIcon={episode.publishedAt ? <Users className="size-4" /> : <Share2 className="size-4" />}
          title={episode.publishedAt ? "Os jogadores da campanha assistem a este episódio. Clique para deixar só com os mestres." : "Os jogadores da campanha poderão assistir ao vídeo e à HQ (a versão salva)."}
        >
          {episode.publishedAt ? "Compartilhado" : "Compartilhar"}
        </Button>
        {confirmDelete ? (
          <>
            <Button variant="danger" onClick={onDelete} leadingIcon={<Trash2 className="size-4" />}>
              Apagar episódio
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy} leadingIcon={<Trash2 className="size-4" />} aria-label="Apagar episódio" />
        )}
      </div>

      <Tabs items={[{ value: "video", label: "Vídeo" }, { value: "comic", label: "HQ" }]} value={view} onChange={setView} className="self-start" />

      {!blobs ? (
        <LoadingState label="Carregando as imagens…" />
      ) : view === "video" ? (
        <EpisodePlayer key={`${script.scenes.map((s) => `${s.id}${s.seconds}`).join()}`} script={script} images={urls} campaignName={campaignName} music={music} voices={voices} watermark={watermark} />
      ) : (
        <ComicView script={script} blobs={blobs} campaignName={campaignName} fileBase={`${slug(campaignName)}-${slug(script.title)}`} watermark={watermark} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void illustrate()} disabled={busy || !blobs} leadingIcon={<Palette className="size-4" />}>
          {missing === 0 ? "Tudo ilustrado" : `Ilustrar ${missing} cena(s)`}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void recordNarration()}
          disabled={busy || unvoiced === 0}
          leadingIcon={<Mic className="size-4" />}
          title={voiceLive ? "Grava a voz do narrador (Gemini) para cada recordatório: ela entra na prévia e no MP4." : "Sem GEMINI_API_KEY, a prévia lê os recordatórios com a voz do navegador."}
        >
          {unvoiced === 0 ? "Narração gravada" : `Gravar narração (${unvoiced})`}
        </Button>
        <Button variant="secondary" onClick={() => void exportVideo()} disabled={busy || !blobs} leadingIcon={exporting !== null ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}>
          {exporting !== null ? `Exportando… ${Math.round(exporting * 100)}%` : "Exportar vídeo (MP4)"}
        </Button>
        <span className="ml-auto text-xs text-fg-subtle">
          {script.scenes.length} cenas · {episodeSeconds(script)} s {!imagesLive && "· imagens de exemplo"} {!voiceLive && "· narração do navegador"}
        </span>
      </div>

      {narration && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Mic className="size-4 text-accent" /> Gravando a narração · {narration.filter((s) => s.status === "done").length}/{narration.length}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => abort.current?.abort()} leadingIcon={<X className="size-3.5" />}>
              Parar
            </Button>
          </div>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {narration.map((s) => (
              <li key={s.sceneId} className={cn("flex items-center gap-1.5", s.status === "error" ? "text-danger" : s.status === "done" ? "text-fg-muted" : "text-fg-subtle")}>
                {s.status === "recording" ? <Loader2 className="size-3 animate-spin" /> : s.status === "done" ? <Check className="size-3 text-success" /> : s.status === "error" ? <X className="size-3" /> : <span className="size-3" />}
                {s.label}
                {s.error && <span className="truncate">· {s.error}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AnimatePresence>
        {steps && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Wand2 className="size-4 text-accent" /> Ilustrando · {steps.filter((s) => s.status === "done").length}/{steps.length}
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => abort.current?.abort()} leadingIcon={<X className="size-3.5" />}>
                  Parar
                </Button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full bg-accent-solid" animate={{ width: `${(steps.filter((s) => s.status !== "pending" && s.status !== "drawing").length / Math.max(1, steps.length)) * 100}%` }} />
              </div>
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                {steps.map((s) => (
                  <li key={s.key} className={cn("flex items-center gap-1.5", s.status === "error" ? "text-danger" : s.status === "done" ? "text-fg-muted" : "text-fg-subtle")}>
                    {s.status === "drawing" ? <Loader2 className="size-3 animate-spin" /> : s.status === "done" ? <Check className="size-3 text-success" /> : s.status === "error" ? <X className="size-3" /> : <span className="size-3" />}
                    {s.label}
                    {s.error && <span className="truncate">· {s.error}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <ol className="flex flex-col gap-3">
        {script.scenes.map((scene, i) => {
          const image = urls[sceneImageKey(scene)];
          return (
            <li key={scene.id}>
              <Card className="flex flex-col gap-3 p-3 sm:flex-row">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-56">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  {image ? <img src={image} alt={`Cena ${i + 1}`} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-fg-subtle"><ImagePlus className="size-6" /></div>}
                  <span className="absolute left-1.5 top-1.5 rounded bg-canvas/80 px-1.5 py-0.5 font-mono text-[10px]">{i + 1}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={scene.kind === "roll" ? "accent" : "neutral"}>{KIND_LABEL[scene.kind]}</Badge>
                    <Badge tone="info">{scene.camera}</Badge>
                    <Badge tone="neutral">{scene.mood}</Badge>
                    <label className="ml-auto flex items-center gap-1 text-xs text-fg-subtle">
                      <input type="number" min={3} max={SCENE_SECONDS_MAX} value={scene.seconds} onChange={(e) => editScene(scene.id, { seconds: Math.min(SCENE_SECONDS_MAX, Math.max(3, Number(e.target.value) || 3)) })} className="h-7 w-12 rounded-md border border-line bg-surface-2 text-center font-mono text-xs" aria-label="Duração em segundos" />s
                    </label>
                    <Button size="icon-sm" variant="ghost" disabled={i === 0 || busy} onClick={() => moveScene(i, -1)} aria-label="Subir cena">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" disabled={i === script.scenes.length - 1 || busy} onClick={() => moveScene(i, 1)} aria-label="Descer cena">
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" disabled={busy || script.scenes.length <= 2} onClick={() => edit({ ...script, scenes: script.scenes.filter((s) => s.id !== scene.id) })} aria-label="Tirar cena">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea label="Narração" value={scene.narration} onChange={(e) => editScene(scene.id, { narration: e.target.value })} rows={2} maxLength={280} />
                  {scene.dialogue.map((d, j) => (
                    <div key={j} className="flex gap-2">
                      <Input aria-label="Quem fala" value={d.speaker} onChange={(e) => editScene(scene.id, { dialogue: scene.dialogue.map((x, k) => (k === j ? { ...x, speaker: e.target.value } : x)) })} containerClassName="w-32 shrink-0" maxLength={40} />
                      <Input aria-label="Fala" value={d.line} onChange={(e) => editScene(scene.id, { dialogue: scene.dialogue.map((x, k) => (k === j ? { ...x, line: e.target.value } : x)) })} containerClassName="flex-1" maxLength={140} />
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input aria-label="Onomatopeia" placeholder="Onomatopeia (KRAAK!)" value={scene.sfx} onChange={(e) => editScene(scene.id, { sfx: e.target.value.slice(0, 16) })} containerClassName="w-44" />
                    <details className="min-w-0 flex-1 text-xs text-fg-subtle">
                      <summary className="cursor-pointer select-none">Descrição da imagem</summary>
                      <Textarea aria-label="Descrição da imagem" value={scene.imagePrompt} onChange={(e) => editScene(scene.id, { imagePrompt: e.target.value })} rows={3} maxLength={900} />
                    </details>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void illustrate([sceneImageKey(scene)])} leadingIcon={<RefreshCw className="size-3.5" />}>
                      Redesenhar
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <Clapperboard className="size-3.5" /> O vídeo (Remotion), a trilha sonora e a HQ são montados neste navegador. Exporte o vídeo com a aba aberta e visível.
      </p>
    </div>
  );
}
