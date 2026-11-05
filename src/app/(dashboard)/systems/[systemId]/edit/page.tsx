import { Suspense } from "react";
import { LoadingState } from "@/components/feedback/states";
import { SystemEditorView } from "@/features/systems/components/editor/system-editor-view";

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

/** Editor of a custom system (owner only). Params are runtime data, read inside Suspense. */
export default function SystemEditorPage({ params }: PageProps<"/systems/[systemId]/edit">) {
  return (
    <Suspense fallback={<LoadingState label="Abrindo o editor…" />}>
      {params.then(({ systemId }) => (
        <SystemEditorView systemId={systemId} />
      ))}
    </Suspense>
  );
}
