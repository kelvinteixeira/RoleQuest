import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { SystemsView } from "@/features/systems/components/systems-view";

export const metadata: Metadata = { title: "Sistemas" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function SystemsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SystemsView />
    </Suspense>
  );
}
