import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SCENE_MOODS, type SceneMood } from "@/types/chronicle";
import { isWav, pcmToWav } from "@/features/chronicles/model/wav";

/** One caption box to read aloud. */
export const VoiceRequestSchema = z.object({
  campaignId: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(280),
  mood: z.enum(SCENE_MOODS).default("calm"),
});
export type VoiceRequest = z.infer<typeof VoiceRequestSchema>;

/** The speech model and the narrator's voice; overridable without code changes. */
const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const VOICE = process.env.GEMINI_TTS_VOICE || "Charon";

const TONE: Record<SceneMood, string> = {
  calm: "sereno",
  tense: "tenso, quase sussurrado",
  epic: "épico e empolgado",
  dark: "sombrio e grave",
  triumphant: "triunfante",
  funny: "bem-humorado",
};

export class VoiceRefusedError extends Error {}

/** Reads one caption with Gemini's speech model; returns a WAV file. */
export async function speak(req: VoiceRequest): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const interaction = await ai.interactions.create({
    model: MODEL,
    // The style goes before the line; the caption itself is read word for word.
    input: `Narrador de uma série de aventura, em português do Brasil, tom ${TONE[req.mood]}. Leia: ${req.text}`,
    generation_config: { speech_config: [{ voice: VOICE, language: "pt-BR" }] },
    response_format: { type: "audio", mime_type: "audio/wav", delivery: "inline" },
  });
  const audio = interaction.output_audio;
  if (!audio?.data) throw new VoiceRefusedError("O narrador não devolveu áudio para esta cena. Ajuste o texto e tente de novo.");
  const bytes = new Uint8Array(Buffer.from(audio.data, "base64"));
  // Raw 16-bit PCM (audio/l16) gets a WAV header; WAV passes as is.
  return Buffer.from(isWav(bytes) ? bytes : pcmToWav(bytes, audio.sample_rate || 24_000, audio.channels || 1));
}
