import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { TRACK_TYPES, type AudioTrack } from "@/features/audio-engine/catalog";
import type { ID } from "@/types/common";
import type { UserProfile } from "@/types/user";

export const MAX_TRACK_BYTES = 25 * 1024 * 1024;

/** The audio centre's uploaded tracks for a campaign. */
export const audioService = {
  list: (campaignId: ID) => repositories().audioTracks.list(campaignId),

  /** Uploads an audio file (GMs; the backend checks too). The title defaults to the file name. */
  async upload(campaignId: ID, file: File, user: Pick<UserProfile, "id">): Promise<AudioTrack> {
    if (!(file.type in TRACK_TYPES)) throw new AppError("validation", "Escolha um arquivo de áudio em MP3, OGG, WAV, M4A, AAC, WebM ou FLAC.");
    if (file.size > MAX_TRACK_BYTES) throw new AppError("validation", "Faixas de até 25 MB.");
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Faixa";
    return repositories().audioTracks.upload(campaignId, file, title, user.id);
  },

  remove: (track: AudioTrack) => repositories().audioTracks.remove(track),

  /** The file to play (members download it to play along). */
  file: (ref: string) => repositories().audioTracks.file(ref),
};
