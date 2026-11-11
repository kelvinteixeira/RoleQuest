import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/feedback/states";
import { SharedEpisodes } from "@/features/chronicles/components/shared-episodes";

// Client-side AuthGuard gates this page (see docs/ARCHITECTURE.md §5).
export const instant = false;

export const metadata: Metadata = { title: "Episódios" };

/** The episodes the GMs shared with the campaign's players. Params are runtime data, read inside Suspense. */
export default function EpisodesPage({ params }: PageProps<"/campaign/[campaignId]/episodes">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo os episódios…" />}>
      {params.then(({ campaignId }) => (
        <SharedEpisodes campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
