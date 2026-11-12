import type Stripe from "stripe";
import { addCredits, firstDelivery, saveSubscription, stripeClient } from "@/server/billing";
import { reportServerError } from "@/server/errors";

/**
 * Stripe → app. The only place plans and credits are written (service role).
 * Subscribe the endpoint in Stripe to: checkout.session.completed,
 * checkout.session.async_payment_succeeded, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Webhook não configurado." }, { status: 501 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ error: "Assinatura inválida." }, { status: 400 });
  }
  if (!(await firstDelivery(event.id))) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (!userId) break;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
          await saveSubscription(sub, userId);
        } else if (session.metadata?.kind === "credits" && session.payment_status === "paid") {
          await addCredits(userId, Number(session.metadata.credits) || 0);
        }
        break;
      }
      // Pix confirms after the checkout closes.
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (userId && session.metadata?.kind === "credits") await addCredits(userId, Number(session.metadata.credits) || 0);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await saveSubscription(event.data.object);
        break;
    }
  } catch (error) {
    await reportServerError(error, { where: "billing webhook", event: event.type });
    // A 500 makes Stripe deliver it again later.
    return Response.json({ error: "Falha ao processar." }, { status: 500 });
  }
  return Response.json({ received: true });
}
