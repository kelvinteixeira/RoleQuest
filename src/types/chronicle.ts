import type { ID, ISODateString, Timestamps } from "./common";

export const CAMERA_MOVES = ["push-in", "pull-out", "pan-left", "pan-right", "tilt-up", "still"] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const SCENE_MOODS = ["calm", "tense", "epic", "dark", "triumphant", "funny"] as const;
export type SceneMood = (typeof SCENE_MOODS)[number];

export type SceneKind = "title" | "scene" | "roll" | "end";

/** One beat of an episode: an image with camera movement, a caption, balloons and maybe a dice roll. */
export interface EpisodeScene {
  id: string;
  kind: SceneKind;
  /** Caption box (recordatório), in Portuguese. */
  narration: string;
  /** Speech balloons, in order. */
  dialogue: { speaker: string; line: string }[];
  /** What the image shows, for the image model (English works best). */
  imagePrompt: string;
  /** Characters on the panel (names from the episode's cast). */
  cast: string[];
  camera: CameraMove;
  mood: SceneMood;
  /** Onomatopoeia drawn over the panel ("" for none). */
  sfx: string;
  seconds: number;
  /** A decisive roll shown as a big die. */
  roll: { label: string; total: number; natural: number } | null;
}

export interface EpisodeScript {
  title: string;
  logline: string;
  /** Art direction shared by every image (English). */
  visualStyle: string;
  /** How each recurring character looks, so every panel draws them the same way. */
  characters: { name: string; look: string }[];
  scenes: EpisodeScene[];
}

export interface ChronicleEpisode extends Timestamps {
  id: ID;
  campaignId: ID;
  title: string;
  momentIds: string[];
  script: EpisodeScript | null;
  /** Image key (scene id or `char:<name>`) -> stored image reference. */
  images: Record<string, string>;
  /** Recorded narration by scene id: the stored clip, the caption it reads (stale once the caption changes) and its length. */
  voices: Record<string, { ref: string; text: string; seconds: number }>;
  /** When the GM shared it with the campaign's players (null: GMs only). */
  publishedAt: ISODateString | null;
  createdBy: ID | null;
}

export type ChronicleEpisodeInput = Pick<ChronicleEpisode, "campaignId" | "title" | "momentIds" | "script" | "images" | "voices" | "publishedAt">;

/** A moment of the campaign worth telling (from the journal), with how dramatic it was. */
export interface ChronicleMoment {
  id: string;
  at: ISODateString;
  sessionLabel: string;
  kind: string;
  text: string;
  score: number;
  /** A GM-only journal entry: never chosen by default (the video may be shown to the players). */
  private: boolean;
}
