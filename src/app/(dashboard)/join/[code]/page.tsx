import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/feedback/states";
import { JoinCampaignView } from "@/features/campaigns/components/join-campaign-view";

// Client-side AuthGuard gates this page: signed-out visitors go to /login and come back here.
export const instant = false;

export const metadata: Metadata = { title: "Convite" };

/** Invite link: /join/{code}. Params are runtime data, read inside Suspense. */
export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o convite…" />}>
      {params.then(({ code }) => (
        <JoinCampaignView code={code} />
      ))}
    </Suspense>
  );
}
