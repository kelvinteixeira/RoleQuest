import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignCharactersView } from "@/features/campaigns/components/campaign-characters-view";

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
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
