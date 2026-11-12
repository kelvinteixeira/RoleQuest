import type { Metadata } from "next";
import { CharactersView } from "@/features/characters/components/characters-view";

export const metadata: Metadata = { title: "Personagens" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function CharactersPage() {
  return <CharactersView />;
}
