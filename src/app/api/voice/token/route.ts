import { signedIn } from "@/server/supabase";
import { livekitConfigured, livekitToken } from "@/server/voice";

/** A LiveKit token for the campaign's voice room, for its members only. */
export async function POST(request: Request) {
  if (!livekitConfigured()) return Response.json({ error: "O servidor de voz não está configurado." }, { status: 501 });
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  const { campaignId } = (await request.json().catch(() => ({}))) as { campaignId?: string };
  if (typeof campaignId !== "string" || !campaignId) return Response.json({ error: "Campanha inválida." }, { status: 400 });

  // Members see their own row (RLS): a row means they belong to the campaign.
  const { data } = await caller.client.from("campaign_members").select("user_id").eq("campaign_id", campaignId).eq("user_id", caller.userId).maybeSingle();
  if (!data) return Response.json({ error: "Você não participa desta campanha." }, { status: 403 });
  const { data: profile } = await caller.client.from("profiles").select("display_name").eq("id", caller.userId).maybeSingle();
  const name = (profile as { display_name?: string } | null)?.display_name ?? "Jogador";
  return Response.json(await livekitToken(campaignId, caller.userId, name), { headers: { "Cache-Control": "no-store" } });
}
