import { repositories } from "@/repositories";

const urls = new Map<string, Promise<string | null>>();

/** Stores and serves the pictures behind imported maps. */
export const mapImageService = {
  /** Stores a picture; with a campaign, its members can see it too (Supabase Storage). */
  async save(blob: Blob, campaignId?: string): Promise<string> {
    return repositories().images.put(blob, campaignId);
  },

  /** The stored picture itself (for re-uploading one kept in this browser only). */
  blob(imageId: string): Promise<Blob | null> {
    return repositories().images.get(imageId);
  },

  /**
   * Object URL for an image (cached once found); null when it is not in this
   * browser. Misses and errors are not cached, so a later look can find it.
   */
  url(imageId: string): Promise<string | null> {
    let url = urls.get(imageId);
    if (!url) {
      url = repositories()
        .images.get(imageId)
        .then((blob) => (blob ? URL.createObjectURL(blob) : null))
        .catch(() => null)
        .then((found) => {
          if (!found) urls.delete(imageId);
          return found;
        });
      urls.set(imageId, url);
    }
    return url;
  },
};
