import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignOverview } from "@/features/campaigns/components/campaign-overview";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

/** Params are runtime data under Cache Components, so access stays inside Suspense. */
export default function CampaignPage({ params }: PageProps<"/campaign/[campaignId]">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo campanha…" />}>
      {params.then(({ campaignId }) => (
        <CampaignOverview campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
