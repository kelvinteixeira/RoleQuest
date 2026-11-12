import { stripeClient } from "@/server/billing";
import { reportServerError } from "@/server/errors";
import { signedIn } from "@/server/supabase";

const BUCKETS = ["chronicles", "map-images", "table-audio"];

/**
 * Deletes the caller's account (LGPD): cancels a paid subscription, removes
 * the files of the campaigns they own, then the database rows and the login
 * (`delete_my_account`).
 */
export async function POST(request: Request) {
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  const { client, userId } = caller;

  try {
    const stripe = stripeClient();
    const { data: sub } = await client.from("subscriptions").select("stripe_subscription_id, status").eq("user_id", userId).maybeSingle();
    const subscription = sub as { stripe_subscription_id?: string; status?: string } | null;
    if (stripe && subscription?.stripe_subscription_id && subscription.status !== "canceled") await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    // Files under each owned campaign's folder (the owner is GM there, so RLS lets them delete).
    const { data: owned } = await client.from("campaigns").select("id").eq("owner_id", userId);
    for (const { id } of (owned ?? []) as { id: string }[]) {
      for (const bucket of BUCKETS) {
        const paths: string[] = [];
        const walk = async (prefix: string) => {
          const { data } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
          for (const item of data ?? []) {
            const path = `${prefix}/${item.name}`;
            if (item.id) paths.push(path);
            else await walk(path);
          }
        };
        await walk(id);
        if (paths.length) await client.storage.from(bucket).remove(paths);
      }
    }

    const { error } = await client.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    return Response.json({ deleted: true });
  } catch (error) {
    await reportServerError(error, { where: "account delete", userId });
    return Response.json({ error: "Não foi possível excluir a conta agora. Tente de novo ou fale com o suporte." }, { status: 500 });
  }
}
