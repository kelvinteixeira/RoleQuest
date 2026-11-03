import type { Metadata } from "next";
import { CharactersView } from "@/features/characters/components/characters-view";

export const metadata: Metadata = { title: "Personagens" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function CharactersPage() {
  return <CharactersView />;
}
