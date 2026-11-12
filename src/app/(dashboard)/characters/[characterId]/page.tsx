import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CharacterSheetPage } from "@/features/character-sheet/components/character-sheet-page";

export const metadata: Metadata = { title: "Ficha" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

/** Params are runtime data under Cache Components, so access stays inside Suspense. */
export default function CharacterPage({ params }: PageProps<"/characters/[characterId]">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo ficha…" />}>
      {params.then(({ characterId }) => (
        <CharacterSheetPage characterId={characterId} />
      ))}
    </Suspense>
  );
}
