import { aiOff, readJson, requireGm } from "@/server/chronicles/auth";
import { speak, VoiceRefusedError, VoiceRequestSchema } from "@/server/chronicles/voice";

export const maxDuration = 60;

/** POST: reads one caption box aloud (Gemini speech) and returns a WAV file. */
export async function POST(request: Request) {
  const body = VoiceRequestSchema.safeParse(await readJson(request, 8_000));
  if (!body.success) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return aiOff("Falta a chave do Gemini (GEMINI_API_KEY) no .env.local para gravar a narração.");
  const denied = await requireGm(request, body.data.campaignId, "voice");
  if (denied) return denied;

  try {
    const wav = await speak(body.data);
    return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof VoiceRefusedError) return Response.json({ error: error.message }, { status: 422 });
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : "";
    console.error("chronicles/voice", error);
    if (status === 401 || status === 403 || (status === 400 && /api key/i.test(message))) return Response.json({ error: "A chave do Gemini foi recusada. Confira GEMINI_API_KEY." }, { status: 502 });
    if (status === 429) return Response.json({ error: "Limite do Gemini atingido. Espere um pouco e tente de novo." }, { status: 429 });
    return Response.json({ error: "Não deu para gravar a narração. Tente de novo." }, { status: 502 });
  }
}
