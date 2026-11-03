import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignWizard } from "@/features/campaigns/wizard/campaign-wizard";

export const metadata: Metadata = { title: "Nova campanha" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CampaignWizard />
    </Suspense>
  );
}
