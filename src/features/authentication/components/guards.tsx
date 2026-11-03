"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { useAuth } from "../hooks/use-auth";

function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center" role="status" aria-label="Carregando">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}

/**
 * Client-side protection while auth is local. In Phase 7 a server-side check
 * (proxy.ts + Supabase cookies) runs first and this stays as a UX fallback.
 */
export function AuthGuard({ children, requireOnboarding = true }: { children: ReactNode; requireOnboarding?: boolean }) {
  const { status, user, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const refreshed = useRef(false);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (status === "authenticated" && !refreshed.current) {
      refreshed.current = true;
      void refreshProfile();
    }
  }, [status, router, pathname, refreshProfile]);

  const needsOnboarding = status === "authenticated" && requireOnboarding && user && !user.onboardingCompleted;

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (status !== "authenticated" || needsOnboarding) return <SplashScreen />;
  return <>{children}</>;
}

/** Sends signed-in users away from login/register screens. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status !== "anonymous") return <SplashScreen />;
  return <>{children}</>;
}
