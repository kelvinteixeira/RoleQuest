import { Suspense } from "react";
import { AuthGuard } from "@/features/authentication/components/guards";

/** Full-screen layout for the virtual tabletop: no app sidebar, same auth gate. */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
