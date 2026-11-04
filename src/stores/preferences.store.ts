import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PreferencesState = {
  sidebarCollapsed: boolean;
  /** Table sound effects on/off (dice, doors, hits…). */
  diceSounds: boolean;
  reduceMotion: boolean;
  /** Table sound effects volume, 0..1. */
  effectsVolume: number;
  setEffectsVolume: (value: number) => void;
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
      effectsVolume: 0.6,
      setEffectsVolume: (value) => set({ effectsVolume: Math.max(0, Math.min(1, value)) }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setDiceSounds: (value) => set({ diceSounds: value }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
    }),
    {
      name: "rq:preferences:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sidebarCollapsed, diceSounds, reduceMotion, effectsVolume }) => ({ sidebarCollapsed, diceSounds, reduceMotion, effectsVolume }),
      skipHydration: true,
    },
  ),
);
