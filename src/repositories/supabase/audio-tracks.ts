/**
 * The audio centre's uploaded tracks on Supabase: rows in
 * campaign_audio_tracks, files in the private `table-audio` bucket
 * (`<campaign>/<uuid>.<ext>`). Members download them to play along; GMs manage them.
 */
import { supabase } from "@/lib/supabase/client";
import { TRACK_TYPES, type AudioTrack } from "@/features/audio-engine/catalog";
import type { AudioTrackRepository } from "../contracts";
import { toAppError, unwrap } from "./errors";

type Row = Record<string, unknown>;
const BUCKET = "table-audio";

const toTrack = (r: Row): AudioTrack => ({
  id: r.id as string,
  campaignId: r.campaign_id as string,
  title: r.title as string,
  ref: r.path as string,
  mimeType: r.mime_type as string,
  createdAt: r.created_at as string,
});

const extensionOf = (file: Blob) => TRACK_TYPES[file.type] ?? "mp3";

export const supabaseAudioTracks: AudioTrackRepository = {
  async list(campaignId) {
    return (unwrap(await supabase().from("campaign_audio_tracks").select("*").eq("campaign_id", campaignId).order("created_at")) as Row[]).map(toTrack);
  },
  async upload(campaignId, file, title, userId) {
    const path = `${campaignId}/${crypto.randomUUID()}.${extensionOf(file)}`;
    const { error } = await supabase().storage.from(BUCKET).upload(path, file, { contentType: file.type || "audio/mpeg" });
    if (error) throw toAppError({ message: `Não deu para enviar a faixa: ${error.message}` });
    try {
      return toTrack(unwrap<Row>(await supabase().from("campaign_audio_tracks").insert({ campaign_id: campaignId, title, path, mime_type: file.type || "audio/mpeg", created_by: userId }).select("*").single()));
    } catch (e) {
      await supabase().storage.from(BUCKET).remove([path]);
      throw e;
    }
  },
  async remove(track) {
    unwrap(await supabase().from("campaign_audio_tracks").delete().eq("id", track.id));
    const { error } = await supabase().storage.from(BUCKET).remove([track.ref]);
    if (error) throw toAppError({ message: `A faixa saiu da lista, mas o arquivo não foi apagado: ${error.message}` });
  },
  async file(ref) {
    const { data, error } = await supabase().storage.from(BUCKET).download(ref);
    return error ? null : data;
  },
};
