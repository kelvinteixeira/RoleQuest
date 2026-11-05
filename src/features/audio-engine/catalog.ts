/**
 * What the audio centre offers out of the box: ambiences and music themes
 * synthesised in the browser (no files to ship or license), plus the GM's own
 * uploaded tracks. Pure data, shared by the engine and the UI.
 */

export const AMBIENCES = [
  { id: "rain", label: "Chuva", emoji: "🌧️" },
  { id: "storm", label: "Tempestade", emoji: "⛈️" },
  { id: "wind", label: "Vento", emoji: "🌬️" },
  { id: "fire", label: "Fogueira", emoji: "🔥" },
  { id: "forest", label: "Floresta à noite", emoji: "🌲" },
  { id: "dungeon", label: "Masmorra", emoji: "🕯️" },
  { id: "tavern", label: "Taverna", emoji: "🍺" },
  { id: "ocean", label: "Mar", emoji: "🌊" },
] as const;
export type AmbienceId = (typeof AMBIENCES)[number]["id"];

export const THEMES = [
  { id: "explore", label: "Exploração", hint: "Calma, harpa e cordas" },
  { id: "tension", label: "Tensão", hint: "Batida grave e drone" },
  { id: "combat", label: "Combate", hint: "Tambores e metais" },
  { id: "mystery", label: "Mistério", hint: "Sinos e menor" },
  { id: "tavern", label: "Taverna", hint: "Alaúde animado" },
  { id: "victory", label: "Vitória", hint: "Fanfarra" },
] as const;
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
