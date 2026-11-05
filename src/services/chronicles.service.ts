import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { demoScript } from "@/features/chronicles/model/demo-script";
import { momentsFromJournal, pickHighlights } from "@/features/chronicles/model/moments";
import { placeholderImage } from "@/features/chronicles/model/placeholder";
import { castOf, portraitPrompt, scenePrompt } from "@/features/chronicles/model/prompts";
import { characterImageKey, normalizeScript, sceneImageKey, type GeneratedScript } from "@/features/chronicles/model/script";
import type { ChronicleEpisode, ChronicleMoment, EpisodeScene, EpisodeScript } from "@/types/chronicle";
import type { ID } from "@/types/common";
import type { Npc } from "@/types/gm";
import type { UserProfile } from "@/types/user";
import { campaignService, type CampaignOverview } from "./campaign.service";

export interface StudioData {
  overview: CampaignOverview;
  moments: ChronicleMoment[];
  /** Moments chosen by default for a new episode. */
  highlightIds: string[];
  npcs: Npc[];
  episodes: ChronicleEpisode[];
  ai: { script: boolean; images: boolean };
}

export type IllustrationStep = { key: string; label: string; status: "pending" | "drawing" | "done" | "error"; error?: string };

/** Calls one of the app's own AI routes (the backend token proves the caller is a GM of the campaign). */
async function callRoute(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const token = await repositories().auth.accessToken();
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
    signal,
  });
}

/** A portrait as a reference for the image model: at most 512 px, JPEG (small requests, same likeness). */
async function referenceOf(blob: Blob): Promise<{ mimeType: string; data: string }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/jpeg", 0.85));
  return { mimeType: "image/jpeg", data: await toBase64(jpeg) };
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

async function errorOf(response: Response): Promise<{ message: string; missingKey: boolean }> {
  const body = (await response.json().catch(() => null)) as { error?: string; missingKey?: boolean } | null;
  return { message: body?.error ?? `Erro ${response.status}.`, missingKey: !!body?.missingKey };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function contextOf(overview: CampaignOverview, npcs: Npc[]) {
  const { campaign } = overview;
  return {
    campaign: {
      name: campaign.name,
      tagline: campaign.tagline,
      system: overview.system.name,
      narratorName: campaign.gameMaster.narratorName,
      world: { name: campaign.world.name, premise: campaign.world.premise, tone: campaign.world.tone, startingLocation: campaign.world.startingLocation },
    },
    characters: overview.members.flatMap((m) => (m.character ? [{ name: m.character.name, concept: m.character.concept, player: m.profile.displayName }] : [])),
    // Public side of the NPCs only: secrets never go into a video.
    npcs: npcs.filter((n) => n.known).slice(0, 20).map((n) => ({ name: n.name, concept: n.concept, description: n.description.slice(0, 600) })),
  };
}

/**
 * Chronicles Studio: the campaign's best moments become an episode — a script
 * (Claude), illustrated panels (Gemini) and a video made in the browser.
 * Without keys, a rule-written script and stand-in images keep it working.
 */
export const chroniclesService = {
  async loadStudio(campaignId: ID, user: Pick<UserProfile, "id">): Promise<StudioData> {
    const overview = await campaignService.getOverview(campaignId, user.id);
    if (overview.role !== "game_master") throw new AppError("forbidden", "Só os mestres da campanha criam episódios.");
    const repo = repositories();
    const [journal, npcs, episodes, ai] = await Promise.all([
      repo.journal.listForCampaign(campaignId),
      repo.npcs.listForCampaign(campaignId),
      repo.chronicles.listEpisodes(campaignId),
      fetch("/api/chronicles/status")
        .then((r) => r.json() as Promise<{ script: boolean; images: boolean }>)
        .catch(() => ({ script: false, images: false })),
    ]);
    const moments = momentsFromJournal(journal);
    return { overview, moments, highlightIds: pickHighlights(moments).map((m) => m.id), npcs, episodes, ai };
  },

  /** Writes the script for the chosen moments. `demo`: written by rules (no script AI configured). */
  async writeScript(data: Pick<StudioData, "overview" | "npcs">, moments: ChronicleMoment[], direction = ""): Promise<{ script: EpisodeScript; demo: boolean }> {
    if (moments.length === 0) throw new AppError("validation", "Escolha pelo menos um momento.");
    const context = contextOf(data.overview, data.npcs);
    const response = await callRoute("/api/chronicles/script", {
      campaignId: data.overview.campaign.id,
      ...context,
      moments: moments.slice(0, 40).map((m) => ({ id: m.id, sessionLabel: m.sessionLabel, kind: m.kind, text: m.text.slice(0, 400), score: m.score })),
      direction,
    });
    if (response.ok) {
      const { script } = (await response.json()) as { script: GeneratedScript };
      return { script: normalizeScript(script, () => createId("sc")), demo: false };
    }
    const error = await errorOf(response);
    if (!error.missingKey) throw new AppError("unknown", error.message);
    return { script: normalizeScript(demoScript(context, moments), () => createId("sc")), demo: true };
  },

  async createEpisode(campaignId: ID, user: Pick<UserProfile, "id">, momentIds: string[], script: EpisodeScript): Promise<ChronicleEpisode> {
    return repositories().chronicles.createEpisode({ campaignId, title: script.title, momentIds, script, images: {} }, user.id);
  },

  async saveScript(episode: ChronicleEpisode, script: EpisodeScript): Promise<ChronicleEpisode> {
    return repositories().chronicles.updateEpisode(episode.id, { title: script.title.trim() || "Episódio", script });
  },

  removeEpisode: (id: ID) => repositories().chronicles.removeEpisode(id),

  /** Loads an episode's images as blobs (key -> blob). */
  async loadImages(episode: ChronicleEpisode): Promise<Record<string, Blob>> {
    const entries = await Promise.all(Object.entries(episode.images).map(async ([key, ref]) => [key, await repositories().chronicles.getImage(ref)] as const));
    return Object.fromEntries(entries.filter((e): e is readonly [string, Blob] => !!e[1]));
  },

  /**
   * Draws what is missing: first a reference portrait per character on screen,
   * then every panel (with the portraits of its cast). `only`: redraw these keys.
   * Each image is saved as soon as it exists, so a stop halfway keeps the rest.
   */
  async illustrate(
    episode: ChronicleEpisode,
    blobs: Record<string, Blob>,
    onStep: (steps: IllustrationStep[], episode: ChronicleEpisode, blobs: Record<string, Blob>) => void,
    options: { only?: string[]; signal?: AbortSignal } = {},
  ): Promise<{ episode: ChronicleEpisode; demo: boolean; aborted: boolean; failed: number }> {
    const script = episode.script;
    if (!script) throw new AppError("validation", "Escreva o roteiro antes de ilustrar.");
    const repo = repositories().chronicles;
    const onScreen = new Set(script.scenes.flatMap((s) => castOf(script, s).map((c) => c.name)));
    const characters = script.characters.filter((c) => onScreen.has(c.name));
    const wanted = (key: string) => (options.only ? options.only.includes(key) : !blobs[key]);
    type Job = { key: string; label: string; prompt: string; aspect: "16:9" | "1:1"; refs: string[]; scene?: EpisodeScene };
    const jobs: Job[] = [
      ...characters.map((c): Job => ({ key: characterImageKey(c.name), label: `Retrato · ${c.name}`, prompt: portraitPrompt(script, c), aspect: "1:1", refs: [] })),
      ...script.scenes.map((s, i): Job => ({ key: sceneImageKey(s), label: `Cena ${i + 1}`, prompt: scenePrompt(script, s), aspect: "16:9", refs: castOf(script, s).map((c) => characterImageKey(c.name)), scene: s })),
    ].filter((j) => wanted(j.key));

    const steps: IllustrationStep[] = jobs.map((j) => ({ key: j.key, label: j.label, status: "pending" }));
    let current = episode;
    const images = { ...blobs };
    let demo = false;
    const references = new Map<string, Promise<{ mimeType: string; data: string }>>();
    onStep([...steps], current, images);

    for (const [i, job] of jobs.entries()) {
      if (options.signal?.aborted) break;
      steps[i] = { ...steps[i], status: "drawing" };
      onStep([...steps], current, images);
      try {
        let blob: Blob;
        const refs = await Promise.all(
          job.refs
            .filter((k) => images[k])
            .map((k) => {
              if (!references.has(k)) references.set(k, referenceOf(images[k]));
              return references.get(k)!;
            }),
        );
        const response = await callRoute("/api/chronicles/image", { campaignId: episode.campaignId, prompt: job.prompt, aspect: job.aspect, references: refs }, options.signal);
        if (response.ok) blob = await response.blob();
        else {
          const error = await errorOf(response);
          if (!error.missingKey) throw new AppError("unknown", error.message);
          demo = true;
          // The stand-in shows the scene number (or the character's name).
          blob = await placeholderImage(job.scene?.mood ?? "calm", job.label.replace(/^(Cena |Retrato · )/, ""), job.aspect);
        }
        const ref = await repo.putImage(episode.campaignId, episode.id, job.key, blob);
        const previous = current.images[job.key];
        images[job.key] = blob;
        references.delete(job.key);
        current = await repo.updateEpisode(current.id, { images: { ...current.images, [job.key]: ref } });
        // A redrawn image with a new reference: the old file goes.
        if (previous && previous !== ref) void repo.removeImage(previous).catch(() => undefined);
        steps[i] = { ...steps[i], status: "done" };
      } catch (error) {
        if (isAbort(error)) {
          steps[i] = { ...steps[i], status: "pending" };
          break;
        }
        steps[i] = { ...steps[i], status: "error", error: error instanceof Error ? error.message : "Falhou." };
      }
      onStep([...steps], current, images);
    }
    onStep([...steps], current, images);
    return { episode: current, demo, aborted: !!options.signal?.aborted, failed: steps.filter((s) => s.status === "error").length };
  },
};
