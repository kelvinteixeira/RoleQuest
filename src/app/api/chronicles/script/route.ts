import Anthropic from "@anthropic-ai/sdk";
import { aiOff, readJson, requireGm } from "@/server/chronicles/auth";
import { ScriptRefusedError, ScriptRequestSchema, writeScript } from "@/server/chronicles/script";

// Writing a whole episode can take a minute or two.
export const maxDuration = 300;

/** POST: writes an episode script from the chosen moments (Claude). */
export async function POST(request: Request) {
  const body = ScriptRequestSchema.safeParse(await readJson(request, 200_000));
  if (!body.success) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return aiOff("Falta a chave da Anthropic (ANTHROPIC_API_KEY) no .env.local.");
  const denied = await requireGm(request, body.data.campaignId, "script");
  if (denied) return denied;

  try {
    return Response.json({ script: await writeScript(body.data) });
  } catch (error) {
    if (error instanceof ScriptRefusedError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY." }, { status: 502 });
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "Muitos pedidos ao Claude agora. Espere um pouco e tente de novo." }, { status: 429 });
    if (error instanceof Anthropic.APIError) return Response.json({ error: `O Claude respondeu com erro (${error.status}). Tente de novo.` }, { status: 502 });
    console.error("chronicles/script", error);
    return Response.json({ error: "Não deu para escrever o roteiro. Tente de novo." }, { status: 500 });
  }
}
