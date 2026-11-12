import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GraphicsQuality } from "@/lib/graphics";

type PreferencesState = {
  sidebarCollapsed: boolean;
  /** Table sound effects on/off (dice, doors, hits…). */
  diceSounds: boolean;
  reduceMotion: boolean;
  /** Table sound effects volume, 0..1. */
  effectsVolume: number;
  /** This listener's level for the table's music and ambience. */
  musicVolume: number;
  ambienceVolume: number;
  /** 3D quality of the table on this device. */
  graphics: GraphicsQuality;
  setGraphics: (value: GraphicsQuality) => void;
  setMusicVolume: (value: number) => void;
  setAmbienceVolume: (value: number) => void;
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
      musicVolume: 0.7,
      ambienceVolume: 0.7,
      graphics: "auto",
      setGraphics: (value) => set({ graphics: value }),
      setMusicVolume: (value) => set({ musicVolume: Math.max(0, Math.min(1, value)) }),
      setAmbienceVolume: (value) => set({ ambienceVolume: Math.max(0, Math.min(1, value)) }),
      setEffectsVolume: (value) => set({ effectsVolume: Math.max(0, Math.min(1, value)) }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setDiceSounds: (value) => set({ diceSounds: value }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
    }),
    {
      name: "rq:preferences:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sidebarCollapsed, diceSounds, reduceMotion, effectsVolume, musicVolume, ambienceVolume, graphics }) => ({ sidebarCollapsed, diceSounds, reduceMotion, effectsVolume, musicVolume, ambienceVolume, graphics }),
      skipHydration: true,
    },
  ),
);
