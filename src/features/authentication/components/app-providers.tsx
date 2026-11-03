"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { useSessionStore } from "@/stores/session.store";
import { usePreferencesStore } from "@/stores/preferences.store";
import { authService } from "@/services/auth.service";

/**
 * Client-side bootstrap: rehydrates persisted stores after mount (avoids SSR
 * mismatches), drops expired sessions and applies the motion preference.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const reduceMotion = usePreferencesStore((s) => s.reduceMotion);

  useEffect(() => {
    void usePreferencesStore.persist.rehydrate();
    void Promise.resolve(useSessionStore.persist.rehydrate()).then(() => {
      const { session, clear } = useSessionStore.getState();
      if (session && !authService.isSessionValid(session)) clear();
      useSessionStore.setState({ hydrated: true });
    });
  }, []);

  return <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>{children}</MotionConfig>;
}
