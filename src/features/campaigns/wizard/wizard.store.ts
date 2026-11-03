import { create } from "zustand";
import type { CampaignDraft } from "./wizard-model";

export type WizardMode = "choose" | "guided" | "scratch";

/** Draft keys whose validation errors live under a different command path. */
const ERROR_PREFIX: Partial<Record<keyof CampaignDraft, string>> = {
  systemMode: "system",
  custom: "system",
  scheduleFirstSession: "firstSession",
};

type WizardState = {
  mode: WizardMode;
  step: number;
  /** Furthest step reached; the step rail only allows jumping up to it. */
  maxVisited: number;
  /** Null until the wizard is opened (needs the current user for defaults). */
  draft: CampaignDraft | null;
  errors: Record<string, string>;
  start: (draft: CampaignDraft, mode?: WizardMode) => void;
  setMode: (mode: WizardMode) => void;
  update: <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => void;
  goTo: (step: number) => void;
  setErrors: (errors: Record<string, string>) => void;
  reset: () => void;
};

/**
 * In-memory draft for the campaign wizard. It survives navigation inside the
 * app (so a half-filled campaign is not lost) and is cleared after creation.
 */
export const useWizardStore = create<WizardState>((set, get) => ({
  mode: "choose",
  step: 0,
  maxVisited: 0,
  draft: null,
  errors: {},
  start: (draft, mode = "choose") => set({ draft, mode, step: 0, maxVisited: 0, errors: {} }),
  setMode: (mode) => set({ mode, errors: {} }),
  update: (key, value) => {
    const { draft, errors } = get();
    if (!draft) return;
    // Editing a field clears the errors it may have caused.
    const prefix = ERROR_PREFIX[key] ?? String(key);
    const remaining = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== prefix && !k.startsWith(`${prefix}.`)));
    set({ draft: { ...draft, [key]: value }, errors: remaining });
  },
  goTo: (step) => set((s) => ({ step, maxVisited: Math.max(s.maxVisited, step) })),
  setErrors: (errors) => set({ errors }),
  reset: () => set({ mode: "choose", step: 0, maxVisited: 0, draft: null, errors: {} }),
}));
