/**
 * Rules modules: what each RPG system computes on top of a character sheet.
 *
 * This file and the pure registry (`registry.ts`) carry no React, so the
 * sheet model, checks and the combat profile can use them; the sheet panel
 * and the guided creation of each system live in the UI registry (`ui.tsx`).
 */
import type { ComponentType } from "react";
import type { CharacterSheet } from "@/types/character";
import type { BuiltInSystemId, SystemTemplate } from "@/types/system";
import type { CheckRequest } from "@/features/character-sheet/model/checks";

/** A number shown in a system's block on the sheet ("CA 16", "Perc. passiva 13"). */
export interface DerivedStat {
  key: string;
  label: string;
  value: string | number;
  /** How it is computed, for a tooltip. */
  hint?: string;
}

/** A saving throw / resistance the system rolls (D&D: one per ability). */
export interface SaveDefinition {
  key: string;
  label: string;
  /** The check it rolls (`save: true` marks it as a saving throw). */
  request: CheckRequest;
  proficient: boolean;
  /** The bonus or target the roll uses. */
  value: number;
}

export interface SystemRules {
  /** The system this module is for; copies (`baseSystemId`) use it too. Absent: the generic module. */
  systemId?: BuiltInSystemId;
  /** Numbers of the system's block on the sheet. */
  derived(system: SystemTemplate, sheet: CharacterSheet, level: number | null): DerivedStat[];
  /** What follows from the rules when `autoDerived` is on; returns the same sheet when nothing changes. */
  sync(system: SystemTemplate, sheet: CharacterSheet, level: number | null): CharacterSheet;
  /** Replaces the generic derived defense of the token, when the module knows better. */
  defense?(system: SystemTemplate, sheet: CharacterSheet, level: number | null): number | null;
  /** Replaces the generic initiative. */
  initiative?(system: SystemTemplate, sheet: CharacterSheet, level: number | null): { value: number; dice?: number } | null;
  /** Saving throws, in the order the sheet shows them. */
  saves?(system: SystemTemplate, sheet: CharacterSheet, level: number | null): SaveDefinition[];
}

/* ---------- UI side ---------- */

export interface PanelProps {
  system: SystemTemplate;
  sheet: CharacterSheet;
  level: number | null;
  readOnly: boolean;
  update: (fn: (sheet: CharacterSheet) => CharacterSheet) => void;
  onCheck: (req: CheckRequest) => void;
}

export interface CreationStepProps<State> {
  system: SystemTemplate;
  step: number;
  state: State;
  onChange: (state: State) => void;
  level: number;
}

/** A guided creation: its steps, what each still needs, and the sheet it builds. */
export interface CreationFlow<State> {
  /** "D&D 5e (SRD 5.1)" — shown under the steps. */
  label: string;
  /** What the guide covers, for the dialog's first screen. */
  summary: string;
  steps: readonly string[];
  initial(system: SystemTemplate): State;
  /** What a step still needs before going on, or null. */
  problem(step: number, state: State, system: SystemTemplate): string | null;
  Step: ComponentType<CreationStepProps<State>>;
  build(system: SystemTemplate, state: State, level: number): { sheet: CharacterSheet; concept: string };
}

export interface SystemRulesUi {
  /** The system's block at the top of the sheet. */
  Panel?: ComponentType<PanelProps>;
  // Each flow keeps its own state type; the dialog only passes it back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creation?: CreationFlow<any>;
}
