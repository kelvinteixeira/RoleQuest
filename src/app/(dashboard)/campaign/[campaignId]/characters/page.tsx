import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignCharactersView } from "@/features/campaigns/components/campaign-characters-view";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

/** The campaign's characters. Params are runtime data, read inside Suspense. */
export default function CampaignCharactersPage({ params }: PageProps<"/campaign/[campaignId]/characters">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo as fichas…" />}>
      {params.then(({ campaignId }) => (
        <CampaignCharactersView campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
