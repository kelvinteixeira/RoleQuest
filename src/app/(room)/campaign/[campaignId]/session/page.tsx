import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { SessionRoom } from "@/features/virtual-tabletop/components/session-room";

export const metadata: Metadata = { title: "Sala de jogo" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

/** Params are runtime data under Cache Components, so access stays inside Suspense. */
export default function SessionPage({ params }: PageProps<"/campaign/[campaignId]/session">) {
  return (
    <Suspense fallback={<LoadingState label="Preparando a mesa…" className="min-h-dvh" />}>
      {params.then(({ campaignId }) => (
        <SessionRoom campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
