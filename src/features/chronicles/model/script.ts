/**
 * The episode script: the shape the AI writes (validated with Zod on the
 * server) and the normalisation every script goes through before it is used.
 */
import { z } from "zod";
import { CAMERA_MOVES, SCENE_MOODS, type EpisodeScene, type EpisodeScript } from "@/types/chronicle";

const GeneratedSceneSchema = z.object({
  kind: z.enum(["title", "scene", "roll", "end"]),
  narration: z.string(),
  dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })),
  imagePrompt: z.string(),
  cast: z.array(z.string()),
  camera: z.enum(CAMERA_MOVES),
  mood: z.enum(SCENE_MOODS),
  sfx: z.string(),
  seconds: z.number(),
  roll: z.object({ label: z.string(), total: z.number(), natural: z.number() }).nullable(),
});

/** What the script model returns (scene ids are added afterwards). */
export const GeneratedScriptSchema = z.object({
  title: z.string(),
  logline: z.string(),
  visualStyle: z.string(),
  characters: z.array(z.object({ name: z.string(), look: z.string() })),
  scenes: z.array(GeneratedSceneSchema),
});
export type GeneratedScript = z.infer<typeof GeneratedScriptSchema>;

export const SCENE_LIMIT = 16;
/** Longest scene: the AI writes up to 9 s; editing or a long narration may stretch one to this. */
export const SCENE_SECONDS_MAX = 12;
const clip = (s: string, max: number) => s.trim().slice(0, max);

/**
 * Ids for every scene, durations in range, text within bounds, the title card
 * first and the end card last, at most SCENE_LIMIT scenes.
 */
export function normalizeScript(raw: GeneratedScript, newId: () => string): EpisodeScript {
  const cast = raw.characters.slice(0, 8).map((c) => ({ name: clip(c.name, 60), look: clip(c.look, 400) }));
  let scenes: EpisodeScene[] = raw.scenes.map((s) => ({
    id: newId(),
    kind: s.kind,
    narration: clip(s.narration, 280),
    dialogue: s.dialogue.slice(0, 3).map((d) => ({ speaker: clip(d.speaker, 40), line: clip(d.line, 140) })),
    imagePrompt: clip(s.imagePrompt, 900),
    cast: s.cast.slice(0, 4).map((n) => clip(n, 60)),
    camera: s.camera,
    mood: s.mood,
    sfx: clip(s.sfx, 16),
    seconds: Math.min(9, Math.max(3, Math.round(Number.isFinite(s.seconds) ? s.seconds : 5))),
    roll: s.roll && Number.isFinite(s.roll.total) && Number.isFinite(s.roll.natural) ? { label: clip(s.roll.label, 80), total: Math.round(s.roll.total), natural: Math.round(s.roll.natural) } : null,
  }));
  const title = scenes.find((s) => s.kind === "title");
  const end = scenes.find((s) => s.kind === "end");
  const middle = scenes.filter((s) => s.kind !== "title" && s.kind !== "end").slice(0, SCENE_LIMIT - 2);
  scenes = [...(title ? [title] : []), ...middle, ...(end ? [end] : [])];
  return { title: clip(raw.title, 120) || "Episódio", logline: clip(raw.logline, 280), visualStyle: clip(raw.visualStyle, 400), characters: cast, scenes };
}

/** Total length in seconds. */
export const episodeSeconds = (script: Pick<EpisodeScript, "scenes">) => script.scenes.reduce((sum, s) => sum + s.seconds, 0);

/** The image key of a scene, and of a character's reference portrait. */
export const sceneImageKey = (scene: Pick<EpisodeScene, "id">) => scene.id;
export const characterImageKey = (name: string) => `char:${name.toLocaleLowerCase("pt-BR")}`;
