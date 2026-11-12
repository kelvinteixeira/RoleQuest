import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase from API routes.
 * - `signedIn`: the caller's own client (their token, so Row Level Security
 *   applies) after checking the token with Supabase Auth.
 * - `serviceClient`: bypasses RLS. Only for server jobs that act for the app
 *   itself (billing webhook, reminders cron), never with input a user controls
 *   without checking it first. Needs SUPABASE_SERVICE_ROLE_KEY (server only).
 */

export interface SignedIn {
  client: SupabaseClient;
  userId: string;
  email: string | null;
}

export function supabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** The caller's client, or the Response to send back (401) when the token is missing or expired. */
export async function signedIn(request: Request): Promise<SignedIn | Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  return { client, userId: data.user.id, email: data.user.email ?? null };
}

let service: SupabaseClient | null = null;

/** Service-role client, or null when the key is not set (the feature that needs it stays off). */
export function serviceClient(): SupabaseClient | null {
  if (service) return service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}
