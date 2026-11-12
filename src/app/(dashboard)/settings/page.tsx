import type { Metadata } from "next";
import { SettingsView } from "@/features/settings/components/settings-view";

export const metadata: Metadata = { title: "Configurações" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function SettingsPage() {
  return <SettingsView />;
}
