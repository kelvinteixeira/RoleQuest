import "server-only";
import { appConfig } from "@/config/app";
import { signedIn } from "@/server/supabase";

export type AiUse = "script" | "image" | "voice";

/**
 * Local mode has no real accounts, so the AI routes only answer a development
 * server on this machine; a production build in local mode has them off (the
 * studio then uses its rule-written script and stand-in images).
 */
export const aiRoutesEnabled = () => appConfig.dataSource === "supabase" || process.env.NODE_ENV !== "production";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** A JSON error the studio treats like a missing key: it falls back to the stand-ins. */
export const aiOff = (message: string) => Response.json({ error: message, missingKey: true }, { status: 501 });

/**
 * Only a GM of the campaign may spend the AI keys on it, within a daily
 * allowance per person (anyone can create a campaign and be its GM). With
 * Supabase the caller's token is checked and the allowance is counted by the
 * database; in local mode only requests to localhost are served.
 */
export async function requireGm(request: Request, campaignId: string, use: AiUse): Promise<Response | null> {
  if (appConfig.dataSource !== "supabase") {
    if (!aiRoutesEnabled()) return aiOff("A IA do estúdio só funciona com o Supabase ligado.");
    // A dev server listens on the network: keys are only spent for this machine.
    return LOOPBACK.test(request.headers.get("host") ?? "") ? null : Response.json({ error: "Disponível só em localhost no modo local." }, { status: 403 });
  }
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  const { client } = caller;
  // GM check and daily allowance in one step (security definer function).
  const { data: allowed, error: quotaError } = await client.rpc("spend_chronicle_quota", { cid: campaignId, what: use });
  if (quotaError) return Response.json({ error: "Só os mestres da campanha criam episódios." }, { status: 403 });
  if (allowed !== true) {
    const what = { script: "roteiros", image: "imagens", voice: "narrações" }[use];
    return Response.json({ error: `Limite diário de ${what} do seu plano atingido. Volte amanhã, compre créditos ou mude de plano em Configurações → Plano.` }, { status: 429 });
  }
  return null;
}

/** Reads a JSON body of at most `limit` bytes (null when larger, or not JSON). */
export async function readJson(request: Request, limit: number): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}
