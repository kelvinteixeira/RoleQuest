import { CREDIT_PACKS, type CreditPackId } from "@/config/plans";
import { appUrl, creditsInPack, priceForCredits, priceForPlan, stripeClient } from "@/server/billing";
import { signedIn } from "@/server/supabase";

/** Starts a Stripe Checkout: a plan subscription or a credit pack. Payment methods (card, Pix…) come from the Stripe dashboard. */
export async function POST(request: Request) {
  const stripe = stripeClient();
  if (!stripe) return Response.json({ error: "Pagamentos ainda não estão ligados nesta instalação." }, { status: 501 });
  const caller = await signedIn(request);
  if (caller instanceof Response) return caller;
  const body = (await request.json().catch(() => ({}))) as { plan?: string; credits?: string };
  const base = appUrl(request);

  // Reuse the Stripe customer of an earlier subscription, so invoices stay together.
  const { data: sub } = await caller.client.from("subscriptions").select("stripe_customer_id").eq("user_id", caller.userId).maybeSingle();
  const customer = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? undefined;
  const who = customer ? { customer } : { customer_email: caller.email ?? undefined };

  if (body.plan === "mestre" || body.plan === "mesa") {
    const price = priceForPlan(body.plan);
    if (!price) return Response.json({ error: "Plano sem preço configurado." }, { status: 501 });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: caller.userId,
      ...who,
      subscription_data: { metadata: { userId: caller.userId, plan: body.plan } },
      allow_promotion_codes: true,
      success_url: `${base}/settings?billing=ok`,
      cancel_url: `${base}/plans`,
    });
    return Response.json({ url: session.url });
  }

  if (CREDIT_PACKS.some((p) => p.id === body.credits)) {
    const pack = body.credits as CreditPackId;
    const price = priceForCredits(pack);
    if (!price) return Response.json({ error: "Pacote sem preço configurado." }, { status: 501 });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: caller.userId,
      ...who,
      metadata: { userId: caller.userId, kind: "credits", pack, credits: String(creditsInPack(pack)) },
      success_url: `${base}/settings?billing=credits`,
      cancel_url: `${base}/plans`,
    });
    return Response.json({ url: session.url });
  }

  return Response.json({ error: "Escolha um plano ou um pacote de créditos." }, { status: 400 });
}
