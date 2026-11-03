import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CharacterSheetPage } from "@/features/character-sheet/components/character-sheet-page";

export const metadata: Metadata = { title: "Ficha" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
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
