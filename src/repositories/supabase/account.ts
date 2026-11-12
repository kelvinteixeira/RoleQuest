"use client";

import type { BillingStatus } from "@/config/plans";
import { AppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";
import type { AccountRepository } from "../contracts";
import { unwrap } from "./errors";

/** Calls one of the app's API routes as the signed-in user. */
async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError("unauthenticated");
  const res = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AppError(res.status === 401 ? "unauthenticated" : "validation", json.error ?? "Não deu certo. Tente de novo.");
  return json;
}

export const supabaseAccount: AccountRepository = {
  async billing() {
    return unwrap(await supabase().rpc("my_billing")) as BillingStatus;
  },
  async checkout(target) {
    return (await api<{ url: string }>("/api/billing/checkout", target)).url;
  },
  async portal() {
    return (await api<{ url: string }>("/api/billing/portal")).url;
  },
  async watermarkFor(campaignId) {
    const campaign = unwrap(await supabase().from("campaigns").select("owner_id").eq("id", campaignId).single()) as { owner_id: string };
    return (unwrap(await supabase().rpc("plan_of", { uid: campaign.owner_id })) as string) === "free";
  },
  async emailReminders(userId) {
    const row = unwrap(await supabase().from("profiles").select("email_reminders").eq("id", userId).single()) as { email_reminders: boolean };
    return row.email_reminders;
  },
  async setEmailReminders(userId, on) {
    unwrap(await supabase().from("profiles").update({ email_reminders: on }).eq("id", userId));
  },
  async remove() {
    await api("/api/account/delete");
    await supabase().auth.signOut();
  },
};
