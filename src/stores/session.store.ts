import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appConfig } from "@/config/app";
import type { AuthSession, UserProfile } from "@/types/user";

type SessionState = {
  session: AuthSession | null;
  /** Cached profile for instant UI; refreshed from the service on app load. */
  profile: UserProfile | null;
  /** False until persisted state has been read on the client. */
  hydrated: boolean;
  setAuth: (session: AuthSession, profile: UserProfile) => void;
  setProfile: (profile: UserProfile) => void;
  clear: () => void;
};

/**
 * Current user session. Persisted to localStorage while auth is local;
 * Supabase Auth (Phase 7) will own the session and this store will mirror it.
 * `skipHydration` avoids SSR mismatches: <SessionHydrator/> rehydrates on mount.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      hydrated: false,
      setAuth: (session, profile) => set({ session, profile }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({ session: null, profile: null }),
    }),
    {
      name: appConfig.sessionStorageKey,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session, profile }) => ({ session, profile }),
      skipHydration: true,
    },
  ),
);
