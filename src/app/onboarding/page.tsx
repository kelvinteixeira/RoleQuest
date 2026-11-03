import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGuard } from "@/features/authentication/components/guards";
import { Onboarding } from "@/features/authentication/components/onboarding";

export const metadata: Metadata = { title: "Configurar perfil" };

// Client-side AuthGuard gates this page until Phase 7 server auth (see docs/ARCHITECTURE.md §5).
export const instant = false;

export default function OnboardingPage() {
  return (
    <Suspense>
    <AuthGuard requireOnboarding={false}>
      <Onboarding />
    </AuthGuard>
    </Suspense>
  );
}
