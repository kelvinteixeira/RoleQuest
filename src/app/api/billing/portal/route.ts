import { appUrl, stripeClient } from "@/server/billing";
import { signedIn } from "@/server/supabase";

/** Stripe's customer portal: change plan, update the card, cancel, invoices. */
export async function POST(request: Request) {
  const stripe = stripeClient();
  if (!stripe) return Response.json({ error: "Pagamentos ainda não estão ligados nesta instalação." }, { status: 501 });
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  const { data } = await caller.client.from("subscriptions").select("stripe_customer_id").eq("user_id", caller.userId).maybeSingle();
  const customer = (data as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customer) return Response.json({ error: "Você ainda não tem uma assinatura." }, { status: 404 });
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl(request)}/settings` });
  return Response.json({ url: session.url });
}
