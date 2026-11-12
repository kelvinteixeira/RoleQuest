import "server-only";
import Stripe from "stripe";
import type { CreditPackId, PlanId } from "@/config/plans";
import { CREDIT_PACKS } from "@/config/plans";
import { serviceClient } from "./supabase";

/**
 * Stripe billing. Off until STRIPE_SECRET_KEY, the price ids and the
 * webhook secret are set (see .env.example). Prices live in Stripe; the
 * app maps them to plans and credit packs here.
 */

let stripe: Stripe | null = null;
export function stripeClient(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripe = new Stripe(key);
  return stripe;
}

const PLAN_PRICES: Record<Exclude<PlanId, "free">, string | undefined> = {
  mestre: process.env.STRIPE_PRICE_MESTRE,
  mesa: process.env.STRIPE_PRICE_MESA,
};
const CREDIT_PRICES: Record<CreditPackId, string | undefined> = {
  "credits-100": process.env.STRIPE_PRICE_CREDITS_100,
  "credits-300": process.env.STRIPE_PRICE_CREDITS_300,
};

export const priceForPlan = (plan: Exclude<PlanId, "free">) => PLAN_PRICES[plan];
export const priceForCredits = (pack: CreditPackId) => CREDIT_PRICES[pack];
export const creditsInPack = (pack: string) => CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;

/** Plan of a subscription, from its price (or the metadata set at checkout). */
export function planOfSubscription(sub: Stripe.Subscription): Exclude<PlanId, "free"> | null {
  const price = sub.items.data[0]?.price.id;
  const fromPrice = (Object.entries(PLAN_PRICES) as [Exclude<PlanId, "free">, string | undefined][]).find(([, id]) => id && id === price)?.[0];
  const meta = sub.metadata?.plan;
  return fromPrice ?? (meta === "mestre" || meta === "mesa" ? meta : null);
}

/** Writes the subscription as Stripe sees it now (the webhook is the only writer). */
export async function saveSubscription(sub: Stripe.Subscription, userId?: string): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente: a assinatura não pôde ser gravada.");
  const owner = userId ?? sub.metadata?.userId;
  const plan = planOfSubscription(sub);
  if (!owner || !plan) return;
  const periodEnd = sub.items.data[0]?.current_period_end;
  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: owner,
      plan,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function addCredits(userId: string, credits: number): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente: os créditos não puderam ser gravados.");
  const { data } = await db.from("ai_credits").select("balance").eq("user_id", userId).maybeSingle();
  const balance = ((data as { balance?: number } | null)?.balance ?? 0) + credits;
  const { error } = await db.from("ai_credits").upsert({ user_id: userId, balance, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** First time we see this event? (Stripe may deliver one twice.) */
export async function firstDelivery(eventId: string): Promise<boolean> {
  const db = serviceClient();
  if (!db) return true;
  const { error } = await db.from("billing_events").insert({ id: eventId });
  return !error;
}

export const appUrl = (request: Request) => process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
