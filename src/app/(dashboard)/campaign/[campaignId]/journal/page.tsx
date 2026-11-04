import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { JournalView } from "@/features/gm/components/journal-view";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

/** Campaign journal (timeline + NPCs the party knows). Params are runtime data, read inside Suspense. */
export default function JournalPage({ params }: PageProps<"/campaign/[campaignId]/journal">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o diário…" />}>
      {params.then(({ campaignId }) => (
        <JournalView campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
