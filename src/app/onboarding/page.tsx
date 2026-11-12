import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGuard } from "@/features/authentication/components/guards";
import { Onboarding } from "@/features/authentication/components/onboarding";

export const metadata: Metadata = { title: "Configurar perfil" };

// Signed-in page: proxy.ts checks the session on the server (Supabase); the client-side AuthGuard covers local mode.
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
