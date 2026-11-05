/**
 * Map pictures in Supabase Storage (private `map-images` bucket, one folder
 * per campaign): every member of the campaign can see them, only its GMs can
 * upload. Ids are Storage paths (`<campaign>/<uuid>.<ext>`). Older ids without
 * a folder were saved in this browser only (IndexedDB): they are still read
 * from there, and the table's host uploads them (see useLegacyMapImage).
 */
import { supabase } from "@/lib/supabase/client";
import type { MapImageRepository } from "../contracts";
import { mockImages } from "../mock/images";
import { toAppError } from "./errors";

const BUCKET = "map-images";
const extensionOf = (type: string) => (type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp");

export const isStoredMapImage = (id: string) => id.includes("/");

export const supabaseMapImages: MapImageRepository = {
  async put(blob, campaignId) {
    // Outside a campaign there is nobody to share with: keep it in this browser.
    if (!campaignId) return mockImages.put(blob);
    const path = `${campaignId}/${crypto.randomUUID()}.${extensionOf(blob.type)}`;
    const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/webp", upsert: false });
    if (error) throw toAppError({ message: `Não deu para enviar a imagem do mapa: ${error.message}` });
    return path;
  },
  async get(id) {
    if (!isStoredMapImage(id)) return mockImages.get(id);
    const { data, error } = await supabase().storage.from(BUCKET).download(id);
    return error ? null : data;
  },
};
