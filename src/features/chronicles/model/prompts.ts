/**
 * Image prompts for the episode: one reference portrait per recurring
 * character (drawn first), then each panel with the art direction, the cast's
 * looks and the scene itself. The images never contain text: captions and
 * balloons are drawn by the video.
 */
import type { EpisodeScene, EpisodeScript } from "@/types/chronicle";

const NO_TEXT = "No text, letters, captions, logos, watermarks or speech balloons anywhere in the image.";

const MOOD_LIGHT: Record<EpisodeScene["mood"], string> = {
  calm: "soft warm light, quiet atmosphere",
  tense: "low-key lighting, long shadows, held breath",
  epic: "dramatic rim lighting, sweeping scale, dynamic angle",
  dark: "cold desaturated palette, deep shadows, ominous mood",
  triumphant: "golden hour light, heroic low angle, glowing highlights",
  funny: "bright playful colors, expressive faces, comedic timing",
};

/** A clean reference sheet of one character, to keep them the same in every panel. */
export function portraitPrompt(script: Pick<EpisodeScript, "visualStyle">, character: { name: string; look: string }): string {
  return [
    `${script.visualStyle}.`,
    `Character reference portrait of ${character.name}: ${character.look}.`,
    "Three-quarter view, upper body, neutral plain background, clear readable silhouette and colors.",
    NO_TEXT,
  ].join(" ");
}

/** The panel of one scene. */
export function scenePrompt(script: Pick<EpisodeScript, "visualStyle" | "characters">, scene: Pick<EpisodeScene, "imagePrompt" | "cast" | "mood" | "kind">): string {
  const looks = script.characters.filter((c) => scene.cast.some((n) => n.toLocaleLowerCase("pt-BR") === c.name.toLocaleLowerCase("pt-BR")));
  return [
    `${script.visualStyle}.`,
    scene.kind === "title" ? "Opening establishing shot, cinematic wide composition with room for a title." : "Cinematic comic book panel, 16:9 widescreen composition.",
    scene.imagePrompt,
    looks.length ? `Characters (keep them exactly like the reference images): ${looks.map((c) => `${c.name} — ${c.look}`).join("; ")}.` : "",
    `${MOOD_LIGHT[scene.mood]}.`,
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Reference portraits for a scene's cast (at most four, the model's limit for characters). */
export function castOf(script: Pick<EpisodeScript, "characters">, scene: Pick<EpisodeScene, "cast">): { name: string; look: string }[] {
  return script.characters.filter((c) => scene.cast.some((n) => n.toLocaleLowerCase("pt-BR") === c.name.toLocaleLowerCase("pt-BR"))).slice(0, 4);
}
