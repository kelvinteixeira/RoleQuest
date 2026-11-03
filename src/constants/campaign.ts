import type { CampaignStatus } from "@/types/campaign";
import type { BadgeTone } from "@/components/ui/primitives";

export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  /** Accent used for campaign covers and highlights. */
  accent: string;
  gradient: [string, string];
}

/** Presets for "Escolha do estilo visual" in campaign creation. */
export const VISUAL_STYLES: readonly VisualStyle[] = [
  {
    id: "obsidian",
    name: "Obsidiana",
    description: "O visual da marca: preto profundo e violeta. Deixa o mapa e as fichas falarem.",
    accent: "oklch(0.7 0.2 302)",
    gradient: ["oklch(0.27 0.05 300)", "oklch(0.14 0.01 300)"],
  },
  {
    id: "mist",
    name: "Névoa",
    description: "Tons frios e dessaturados para mistério e horror.",
    accent: "oklch(0.76 0.07 210)",
    gradient: ["oklch(0.32 0.04 210)", "oklch(0.16 0.015 230)"],
  },
  {
    id: "ember",
    name: "Brasa",
    description: "Quente e intenso. Batalhas, guerras e heroísmo.",
    accent: "oklch(0.7 0.18 35)",
    gradient: ["oklch(0.35 0.12 35)", "oklch(0.17 0.03 20)"],
  },
  {
    id: "grove",
    name: "Bosque",
    description: "Verdes profundos para jornadas e natureza.",
    accent: "oklch(0.76 0.13 150)",
    gradient: ["oklch(0.32 0.07 155)", "oklch(0.16 0.02 170)"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Contraste forte para futuros distópicos.",
    accent: "oklch(0.74 0.19 330)",
    gradient: ["oklch(0.32 0.13 320)", "oklch(0.15 0.05 270)"],
  },
  {
    id: "astral",
    name: "Astral",
    description: "Violetas e azuis para o sobrenatural e o cósmico.",
    accent: "oklch(0.74 0.13 285)",
    gradient: ["oklch(0.3 0.09 285)", "oklch(0.15 0.03 270)"],
  },
];

export function getVisualStyle(id: string): VisualStyle {
  return VISUAL_STYLES.find((s) => s.id === id) ?? VISUAL_STYLES[0];
}

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  planning: { label: "Em preparação", tone: "info" },
  active: { label: "Em andamento", tone: "success" },
  paused: { label: "Pausada", tone: "warning" },
  completed: { label: "Concluída", tone: "neutral" },
};

export const WORLD_TONES = [
  "Heroico",
  "Sombrio",
  "Mistério",
  "Horror",
  "Político",
  "Exploração",
  "Comédia",
  "Drama",
  "Ação",
  "Sobrevivência",
  "Romance",
  "Épico",
] as const;

export const NARRATION_STYLES = [
  { id: "cinematic", label: "Cinematográfico", description: "Descrições visuais, cortes rápidos, foco em cenas." },
  { id: "literary", label: "Literário", description: "Narração rica, ritmo calmo, atenção a detalhes." },
  { id: "sandbox", label: "Mundo aberto", description: "Jogadores conduzem; o mundo reage." },
  { id: "tactical", label: "Tático", description: "Foco em combate, mapas e decisões estratégicas." },
] as const;

export const AVATAR_COLORS = [
  "oklch(0.62 0.16 30)",
  "oklch(0.62 0.14 70)",
  "oklch(0.6 0.13 150)",
  "oklch(0.6 0.12 200)",
  "oklch(0.58 0.15 255)",
  "oklch(0.58 0.17 300)",
  "oklch(0.6 0.17 350)",
  "oklch(0.55 0.03 270)",
] as const;
