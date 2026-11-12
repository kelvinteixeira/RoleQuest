import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignOverview } from "@/features/campaigns/components/campaign-overview";

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
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
