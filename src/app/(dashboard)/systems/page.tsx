import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { SystemsView } from "@/features/systems/components/systems-view";

export const metadata: Metadata = { title: "Sistemas" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function SystemsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SystemsView />
    </Suspense>
  );
}
