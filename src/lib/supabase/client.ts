"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

let client: SupabaseClient | null = null;

/** Where sessions lived before they moved to cookies (read once, then removed). */
const LEGACY_STORAGE_KEY = "rq:supabase-auth";

/**
 * Browser Supabase client (anon/publishable key + the signed-in user's
 * session). The session is kept in cookies so the server (proxy.ts) can tell
 * who is signed in before rendering a protected page. Every query runs under
 * Row Level Security, so this key is safe in the browser; the service-role
 * key is only used by server jobs (billing webhook, reminders).
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new AppError("unknown", "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (veja .env.example).");
  }
  // Implicit flow, as before: e-mail links (confirmation, password reset) work on any device.
  client = createBrowserClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  adoptLegacySession(client);
  return client;
}

/** People signed in before the move keep their session: it is handed to the cookie storage once. */
function adoptLegacySession(c: SupabaseClient) {
  if (typeof window === "undefined") return;
  let stored: { access_token?: string; refresh_token?: string } | null = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null");
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    return;
  }
  if (stored?.access_token && stored.refresh_token) void c.auth.setSession({ access_token: stored.access_token, refresh_token: stored.refresh_token }).catch(() => undefined);
}
