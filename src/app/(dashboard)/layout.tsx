import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/features/authentication/components/guards";

/** AuthGuard reads the URL, which is runtime data under Cache Components: keep it inside Suspense. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </Suspense>
  );
}
