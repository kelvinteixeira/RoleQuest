import type { ChronicleEpisode, EpisodeScene } from "@/types/chronicle";

const scene = (id: string, s: Omit<EpisodeScene, "id" | "imagePrompt" | "cast" | "dialogue" | "sfx" | "roll"> & Partial<EpisodeScene>): EpisodeScene => ({
  id,
  imagePrompt: "",
  cast: [],
  dialogue: [],
  sfx: "",
  roll: null,
  ...s,
});

/**
 * A shared episode in "Protocolo Lâmina Fria", where the demo account is a
 * player: what players see once their GM (Lia) shares an episode. No images
 * (the video and the comic show colour panels), no recorded narration (the
 * browser reads the captions).
 */
export function seedEpisodes(now: Date): ChronicleEpisode[] {
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  return [
    {
      id: "ep_lamina_1",
      campaignId: "c_lamina",
      title: "Nível -3",
      momentIds: [],
      script: {
        title: "Nível -3",
        logline: "Um contrato simples, um elevador que desce demais e uma corporação que não perdoa.",
        visualStyle: "Neon-soaked cyberpunk comic art, heavy inks, magenta and cyan lights, rain.",
        characters: [{ name: "Kael Vantor", look: "Tall solo with a chrome left arm, black coat, short white hair." }],
        scenes: [
          scene("sc_l1", { kind: "title", narration: "No Distrito Vértice, todo contrato tem letras miúdas.", camera: "push-in", mood: "dark", seconds: 5 }),
          scene("sc_l2", { kind: "scene", narration: "O Bar Estática ainda vibrava quando Kael aceitou o serviço.", dialogue: [{ speaker: "Kael Vantor", line: "Simples. Entrar, pegar o chip, sair." }], camera: "pan-right", mood: "tense", seconds: 6, cast: ["Kael Vantor"] }),
          scene("sc_l3", { kind: "roll", narration: "Os drones de segurança viraram ao mesmo tempo.", camera: "still", mood: "epic", seconds: 5, roll: { label: "Kael · Armas de Fogo", total: 24, natural: 20 } }),
          scene("sc_l4", { kind: "scene", narration: "Três tiros. Três drones a menos. E um alarme que ninguém tinha previsto.", sfx: "BLAM!", camera: "push-in", mood: "epic", seconds: 6, cast: ["Kael Vantor"] }),
          scene("sc_l5", { kind: "end", narration: "O elevador ainda descia. Ninguém sabia até onde.", camera: "pull-out", mood: "dark", seconds: 5 }),
        ],
      },
      images: {},
      voices: {},
      publishedAt: at(-8),
      createdBy: "user_lia",
      createdAt: at(-9),
      updatedAt: at(-8),
    },
  ];
}
