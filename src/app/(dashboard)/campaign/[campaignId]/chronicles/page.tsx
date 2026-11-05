import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/feedback/states";
import { ChroniclesStudio } from "@/features/chronicles/components/chronicles-studio";

// Client-side AuthGuard gates this page (see docs/ARCHITECTURE.md §5).
export const instant = false;

export const metadata: Metadata = { title: "Chronicles Studio" };

/** Chronicles Studio of one campaign. Params are runtime data, read inside Suspense. */
export default function ChroniclesPage({ params }: PageProps<"/campaign/[campaignId]/chronicles">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o estúdio…" />}>
      {params.then(({ campaignId }) => (
        <ChroniclesStudio campaignId={campaignId} />
      ))}
    </Suspense>
  );
}
