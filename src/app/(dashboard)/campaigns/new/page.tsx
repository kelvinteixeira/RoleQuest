import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { CampaignWizard } from "@/features/campaigns/wizard/campaign-wizard";

export const metadata: Metadata = { title: "Nova campanha" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CampaignWizard />
    </Suspense>
  );
}
