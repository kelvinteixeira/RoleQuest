"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client (anon/publishable key + the signed-in user's
 * session). Every query runs under Row Level Security, so this key is safe in
 * the browser; the service-role key must never be used in this app.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new AppError("unknown", "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (veja .env.example).");
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "rq:supabase-auth" },
  });
  return client;
}
