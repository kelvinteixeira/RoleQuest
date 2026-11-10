/**
 * What the audio centre offers out of the box: ambiences and music themes
 * synthesised in the browser (no files to ship or license), plus the GM's own
 * uploaded tracks. Pure data, shared by the engine and the UI.
 */

export const AMBIENCE_GROUPS = [
  { id: "weather", label: "Clima" },
  { id: "nature", label: "Natureza" },
  { id: "places", label: "Lugares" },
  { id: "drama", label: "Ação e mistério" },
] as const;
export type AmbienceGroup = (typeof AMBIENCE_GROUPS)[number]["id"];

export const AMBIENCES = [
  { id: "rain", label: "Chuva", emoji: "🌧️", group: "weather" },
  { id: "storm", label: "Tempestade", emoji: "⛈️", group: "weather" },
  { id: "wind", label: "Vento", emoji: "🌬️", group: "weather" },
  { id: "blizzard", label: "Nevasca", emoji: "❄️", group: "weather" },
  { id: "day", label: "Campo de dia", emoji: "🐦", group: "nature" },
  { id: "forest", label: "Floresta à noite", emoji: "🌲", group: "nature" },
  { id: "stream", label: "Riacho", emoji: "💧", group: "nature" },
  { id: "swamp", label: "Pântano", emoji: "🐸", group: "nature" },
  { id: "ocean", label: "Mar", emoji: "🌊", group: "nature" },
  { id: "fire", label: "Fogueira", emoji: "🔥", group: "places" },
  { id: "tavern", label: "Taverna", emoji: "🍺", group: "places" },
  { id: "market", label: "Feira na cidade", emoji: "🏘️", group: "places" },
  { id: "forge", label: "Ferraria", emoji: "⚒️", group: "places" },
  { id: "ship", label: "Navio", emoji: "⛵", group: "places" },
  { id: "dungeon", label: "Masmorra", emoji: "🕯️", group: "drama" },
  { id: "battle", label: "Batalha ao longe", emoji: "⚔️", group: "drama" },
  { id: "volcano", label: "Vulcão", emoji: "🌋", group: "drama" },
  { id: "ritual", label: "Ritual sombrio", emoji: "🔮", group: "drama" },
] as const satisfies readonly { id: string; label: string; emoji: string; group: AmbienceGroup }[];
export type AmbienceId = (typeof AMBIENCES)[number]["id"];

export const THEME_GROUPS = [
  { id: "calm", label: "Calma" },
  { id: "adventure", label: "Aventura" },
  { id: "dark", label: "Tensão e sombra" },
  { id: "fight", label: "Batalha" },
] as const;
export type ThemeGroup = (typeof THEME_GROUPS)[number]["id"];

export const THEMES = [
  { id: "explore", label: "Exploração", hint: "Calma, harpa e cordas", group: "calm" },
  { id: "camp", label: "Acampamento", hint: "Violão ao pé do fogo", group: "calm" },
  { id: "fey", label: "Floresta encantada", hint: "Flauta, sinos e magia", group: "calm" },
  { id: "sacred", label: "Templo sagrado", hint: "Coral e órgão", group: "calm" },
  { id: "sorrow", label: "Lamento", hint: "Cordas lentas em menor", group: "calm" },
  { id: "journey", label: "Jornada", hint: "Marcha heroica na estrada", group: "adventure" },
  { id: "tavern", label: "Taverna", hint: "Alaúde animado", group: "adventure" },
  { id: "sea", label: "Mar aberto", hint: "Canção de marujo", group: "adventure" },
  { id: "desert", label: "Deserto", hint: "Escala exótica e tambor", group: "adventure" },
  { id: "mystery", label: "Mistério", hint: "Sinos e menor", group: "dark" },
  { id: "tension", label: "Tensão", hint: "Batida grave e drone", group: "dark" },
  { id: "dungeon", label: "Masmorra", hint: "Drone, coral distante", group: "dark" },
  { id: "horror", label: "Horror", hint: "Dissonância e silêncio", group: "dark" },
  { id: "combat", label: "Combate", hint: "Tambores e metais", group: "fight" },
  { id: "boss", label: "Chefe", hint: "Coral, tímpanos, épico", group: "fight" },
  { id: "victory", label: "Vitória", hint: "Fanfarra", group: "fight" },
] as const satisfies readonly { id: string; label: string; hint: string; group: ThemeGroup }[];
export type ThemeId = (typeof THEMES)[number]["id"];

export const isAmbienceId = (id: string): id is AmbienceId => AMBIENCES.some((a) => a.id === id);
export const isThemeId = (id: string): id is ThemeId => THEMES.some((t) => t.id === id);

/** A track the GM uploaded for the campaign. */
export interface AudioTrack {
  id: string;
  campaignId: string;
  title: string;
  /** Storage reference of the file. */
  ref: string;
  mimeType: string;
  createdAt: string;
}

/**
 * Audio files a GM may upload, with the extension each is stored under.
 * Keep in step with the `table-audio` bucket in the map_images_and_audio migration.
 */
export const TRACK_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
};
