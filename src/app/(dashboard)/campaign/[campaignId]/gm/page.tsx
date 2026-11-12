import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { GmToolsView } from "@/features/gm/components/gm-tools-view";

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
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
