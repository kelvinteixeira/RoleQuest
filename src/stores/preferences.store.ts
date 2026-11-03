import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PreferencesState = {
  sidebarCollapsed: boolean;
  /** Used by the dice roller and audio engine in later phases. */
  diceSounds: boolean;
  reduceMotion: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;
  setDiceSounds: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
};

/** Per-device UI preferences (not synced to the account). */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      diceSounds: true,
      reduceMotion: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setDiceSounds: (value) => set({ diceSounds: value }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
    }),
    {
      name: "rq:preferences:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sidebarCollapsed, diceSounds, reduceMotion }) => ({ sidebarCollapsed, diceSounds, reduceMotion }),
      skipHydration: true,
    },
  ),
);
