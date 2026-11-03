import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { LibraryView } from "@/features/library/components/library-view";

export const metadata: Metadata = { title: "Biblioteca" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LibraryView />
    </Suspense>
  );
}
