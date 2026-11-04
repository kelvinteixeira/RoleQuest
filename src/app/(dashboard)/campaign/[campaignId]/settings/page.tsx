import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignSettingsView } from "@/features/campaigns/components/settings/campaign-settings-view";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
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
