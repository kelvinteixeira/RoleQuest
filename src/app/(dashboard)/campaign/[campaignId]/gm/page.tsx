import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { GmToolsView } from "@/features/gm/components/gm-tools-view";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

/** GM tools: NPCs, encounters and generators. Params are runtime data, read inside Suspense. */
export default function GmToolsPage({ params }: PageProps<"/campaign/[campaignId]/gm">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo as ferramentas do mestre…" />}>
      {params.then(({ campaignId }) => (
        <GmToolsView campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
