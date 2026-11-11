/**
 * Chronicles Studio on Supabase: episodes in `chronicle_episodes`, images in
 * the private `chronicles` bucket (`<campaign>/<episode>/<key>.<ext>`), narration
 * clips next to them. RLS and Storage policies keep both to the campaign's GMs,
 * plus read access for its players once an episode is shared.
 */
import { supabase } from "@/lib/supabase/client";
import type { ChronicleEpisode, ChronicleEpisodeInput, EpisodeScript } from "@/types/chronicle";
import type { ChronicleRepository } from "../contracts";
import { toAppError, unwrap, unwrapMaybe } from "./errors";

type Row = Record<string, unknown>;
const BUCKET = "chronicles";

const toEpisode = (r: Row): ChronicleEpisode => ({
  id: r.id as string,
  campaignId: r.campaign_id as string,
  title: r.title as string,
  momentIds: (r.moment_ids as string[] | null) ?? [],
  script: (r.script as EpisodeScript | null) ?? null,
  images: (r.images as Record<string, string> | null) ?? {},
  voices: (r.voices as ChronicleEpisode["voices"] | null) ?? {},
  publishedAt: (r.published_at as string | null) ?? null,
  createdBy: (r.created_by as string | null) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

function episodeRow(p: Partial<ChronicleEpisodeInput>): Row {
  const row: Row = {};
  if (p.campaignId !== undefined) row.campaign_id = p.campaignId;
  if (p.title !== undefined) row.title = p.title;
  if (p.momentIds !== undefined) row.moment_ids = p.momentIds;
  if (p.script !== undefined) row.script = p.script;
  if (p.images !== undefined) row.images = p.images;
  if (p.voices !== undefined) row.voices = p.voices;
  if (p.publishedAt !== undefined) row.published_at = p.publishedAt;
  return row;
}

/** Storage keys: letters, digits, dash and underscore only. */
const safeKey = (key: string) => key.normalize("NFD").replace(/[^\w-]+/g, "_").slice(0, 80);
const extensionOf = (type: string) => (type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : type === "audio/wav" ? "wav" : "png");

export const supabaseChronicles: ChronicleRepository = {
  async listEpisodes(campaignId) {
    return (unwrap(await supabase().from("chronicle_episodes").select("*").eq("campaign_id", campaignId).order("updated_at", { ascending: false })) as Row[]).map(toEpisode);
  },
  async listShared(campaignId) {
    return (unwrap(await supabase().from("chronicle_episodes").select("*").eq("campaign_id", campaignId).not("published_at", "is", null).order("published_at", { ascending: false })) as Row[]).map(toEpisode);
  },
  async getEpisode(id) {
    const row = unwrapMaybe<Row>(await supabase().from("chronicle_episodes").select("*").eq("id", id).maybeSingle());
    return row ? toEpisode(row) : null;
  },
  async createEpisode(input, userId) {
    return toEpisode(unwrap<Row>(await supabase().from("chronicle_episodes").insert({ ...episodeRow(input), created_by: userId }).select("*").single()));
  },
  async updateEpisode(id, patch) {
    return toEpisode(unwrap<Row>(await supabase().from("chronicle_episodes").update(episodeRow(patch)).eq("id", id).select("*").single()));
  },
  async removeEpisode(id) {
    const episode = await this.getEpisode(id);
    unwrap(await supabase().from("chronicle_episodes").delete().eq("id", id));
    const paths = [...Object.values(episode?.images ?? {}), ...Object.values(episode?.voices ?? {}).map((v) => v.ref)];
    if (paths.length) {
      const { error } = await supabase().storage.from(BUCKET).remove(paths);
      if (error) console.warn("Chronicles: imagens não removidas", error.message);
    }
  },
  async putImage(campaignId, episodeId, key, blob) {
    const path = `${campaignId}/${episodeId}/${safeKey(key)}.${extensionOf(blob.type)}`;
    const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || "image/png" });
    if (error) throw toAppError({ message: error.message });
    return path;
  },
  async getImage(ref) {
    const { data, error } = await supabase().storage.from(BUCKET).download(ref);
    if (!error) return data;
    // Gone for good: draw it again. Anything else (network…): don't pay to redraw what exists.
    const status = (error as { status?: number; statusCode?: string | number }).status ?? Number((error as { statusCode?: string | number }).statusCode);
    if (status === 404 || status === 400 || /not.?found/i.test(error.message)) return null;
    throw toAppError({ message: `Não deu para baixar uma imagem do episódio: ${error.message}` });
  },
  async removeImage(ref) {
    await supabase().storage.from(BUCKET).remove([ref]);
  },
};
