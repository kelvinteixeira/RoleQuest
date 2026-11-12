import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { LibraryView } from "@/features/library/components/library-view";

export const metadata: Metadata = { title: "Biblioteca" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
export const instant = false;

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LibraryView />
    </Suspense>
  );
}
