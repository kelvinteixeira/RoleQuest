import { aiOff, readJson, requireGm } from "@/server/chronicles/auth";
import { drawImage, ImageRefusedError, ImageRequestSchema } from "@/server/chronicles/image";

export const maxDuration = 120;

/** POST: draws one panel or character portrait (Gemini) and returns the image bytes. */
export async function POST(request: Request) {
  // Prompt plus up to four downscaled reference portraits.
  const body = ImageRequestSchema.safeParse(await readJson(request, 4_000_000));
  if (!body.success) return Response.json({ error: "Pedido inválido (imagens de referência grandes demais?)." }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return aiOff("Falta a chave do Gemini (GEMINI_API_KEY) no .env.local.");
  const denied = await requireGm(request, body.data.campaignId, "image");
  if (denied) return denied;

  try {
    const { bytes, mimeType } = await drawImage(body.data);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": mimeType, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageRefusedError) return Response.json({ error: error.message }, { status: 422 });
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : "";
    console.error("chronicles/image", error);
    // Gemini answers a bad key with 400 "API key not valid".
    if (status === 401 || status === 403 || (status === 400 && /api key/i.test(message))) return Response.json({ error: "A chave do Gemini foi recusada. Confira GEMINI_API_KEY." }, { status: 502 });
    if (status === 429) return Response.json({ error: "Limite do Gemini atingido. Espere um pouco e tente de novo." }, { status: 429 });
    return Response.json({ error: "Não deu para gerar a imagem. Tente de novo." }, { status: 502 });
  }
}
