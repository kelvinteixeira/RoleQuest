"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session.store";
import { authService } from "@/services/auth.service";
import { profileService } from "@/services/profile.service";
import type { SignUpInput, UserProfile } from "@/types/user";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** Session state + auth actions. Components never call the auth service directly. */
export function useAuth() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const profile = useSessionStore((s) => s.profile);
  const hydrated = useSessionStore((s) => s.hydrated);
  const setAuth = useSessionStore((s) => s.setAuth);
  const setProfile = useSessionStore((s) => s.setProfile);
  const clear = useSessionStore((s) => s.clear);

  const status: AuthStatus = !hydrated ? "loading" : session && profile ? "authenticated" : "anonymous";

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { session, profile } = await authService.signIn(email, password);
      setAuth(session, profile);
      return profile;
    },
    [setAuth],
  );

  const signUp = useCallback(
    async (input: SignUpInput & { confirmPassword: string }) => {
      const { session, profile } = await authService.signUp(input);
      setAuth(session, profile);
      return profile;
    },
    [setAuth],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    clear();
    router.replace("/login");
  }, [clear, router]);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const current = useSessionStore.getState().session;
    if (!current) return null;
    try {
      const fresh = await profileService.get(current.userId);
      setProfile(fresh);
      return fresh;
    } catch {
      // Account no longer exists (e.g. local data reset): end the session.
      clear();
      return null;
    }
  }, [setProfile, clear]);

  return { status, session, user: profile, signIn, signUp, signOut, refreshProfile, setProfile };
}

/** For components rendered inside <AuthGuard>, where a user is guaranteed. */
export function useCurrentUser(): UserProfile {
  const profile = useSessionStore((s) => s.profile);
  if (!profile) throw new Error("useCurrentUser must be used inside <AuthGuard>.");
  return profile;
}
