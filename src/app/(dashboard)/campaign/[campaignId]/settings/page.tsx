import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignSettingsView } from "@/features/campaigns/components/settings/campaign-settings-view";

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

/** Campaign settings, table rules and players (GM only). Params are runtime data, read inside Suspense. */
export default function CampaignSettingsPage({ params }: PageProps<"/campaign/[campaignId]/settings">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo as configurações…" />}>
      {params.then(({ campaignId }) => (
        <CampaignSettingsView campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
