/**
 * An episode written by rules, for when no script AI is configured: one scene
 * per moment, the dice moments as rolls, a title and an end card. It keeps the
 * studio usable (and testable) without keys.
 */
import type { ChronicleMoment, EpisodeScene, SceneMood } from "@/types/chronicle";
import type { GeneratedScript } from "./script";

export interface EpisodeContext {
  campaign: { name: string; tagline: string; world: { name: string; tone: string[] } };
  characters: { name: string; concept: string }[];
}

const MOOD: Record<string, SceneMood> = { epic: "epic", critical: "epic", down: "dark", combat: "tense", trap: "tense", reveal: "calm", map: "calm", note: "calm" };
const SFX: Record<string, string> = { critical: "KRAAK!", down: "TUMP!", trap: "CLANK!", combat: "CLASH!", epic: "BOOM!" };

type GeneratedScene = Omit<EpisodeScene, "id">;

export function demoScript(context: EpisodeContext, moments: ChronicleMoment[]): GeneratedScript {
  const names = context.characters.map((c) => c.name);
  const castIn = (text: string) => names.filter((n) => text.includes(n)).slice(0, 4);
  const scenes: GeneratedScene[] = moments.map((m) => {
    const natural = /(\d+) natural/.exec(m.text)?.[1];
    const isRoll = m.kind === "critical" && natural;
    return {
      kind: isRoll ? "roll" : "scene",
      narration: m.text,
      dialogue: [],
      imagePrompt: `A dramatic moment in a fantasy adventure: ${m.text}`,
      cast: castIn(m.text),
      camera: m.score >= 9 ? "push-in" : m.kind === "map" ? "pan-right" : "pull-out",
      mood: MOOD[m.kind] ?? "calm",
      sfx: SFX[m.kind] ?? "",
      seconds: m.score >= 9 ? 6 : 4,
      roll: isRoll ? { label: m.text.split(":").slice(1).join(":").trim() || m.text, total: Number(natural), natural: Number(natural) } : null,
    };
  });
  const first = moments[0]?.sessionLabel;
  const last = moments.at(-1)?.sessionLabel;
  return {
    title: first && last && first !== last ? `${first} a ${last}` : (first ?? "Episódio"),
    logline: context.campaign.tagline || `As aventuras de ${names.join(", ") || "um grupo de heróis"}.`,
    visualStyle: "painterly fantasy comic book art, bold inks, rich colors, cinematic lighting",
    characters: context.characters.map((c) => ({ name: c.name, look: c.concept || "a fantasy adventurer" })),
    scenes: [
      { kind: "title", narration: context.campaign.world.name ? `Em ${context.campaign.world.name}…` : "Era uma vez…", dialogue: [], imagePrompt: "A sweeping fantasy landscape at dawn", cast: names.slice(0, 4), camera: "push-in", mood: "epic", sfx: "", seconds: 5, roll: null },
      ...scenes,
      { kind: "end", narration: "E a história continua na próxima sessão…", dialogue: [], imagePrompt: "The heroes walking into the sunset", cast: names.slice(0, 4), camera: "pull-out", mood: "triumphant", sfx: "", seconds: 5, roll: null },
    ],
  };
}
