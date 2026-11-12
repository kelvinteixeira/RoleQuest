import { signedIn } from "@/server/supabase";
import { iceServersFor } from "@/server/voice";

/** STUN plus short-lived TURN credentials for the signed-in person. */
export async function POST(request: Request) {
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  return Response.json({ iceServers: await iceServersFor(caller.userId) }, { headers: { "Cache-Control": "no-store" } });
}
