import { describe, expect, it } from "vitest";
import { AMBIENCE_GROUPS, AMBIENCES, THEME_GROUPS, THEMES, isAmbienceId, isThemeId } from "./catalog";
import { themeSeconds } from "./music";
import { driveCurve, isVoiceEffectId, pitchSweep, VOICE_EFFECTS } from "@/features/voice-chat/model/voice-effects";

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe("audio catalog", () => {
  it("has unique ids and every entry in a group the panel shows", () => {
    expect(unique(THEMES.map((t) => t.id))).toBe(true);
    expect(unique(AMBIENCES.map((a) => a.id))).toBe(true);
    const themeGroups = new Set(THEME_GROUPS.map((g) => g.id));
    const ambienceGroups = new Set(AMBIENCE_GROUPS.map((g) => g.id));
    for (const t of THEMES) expect(themeGroups.has(t.group), t.id).toBe(true);
    for (const a of AMBIENCES) expect(ambienceGroups.has(a.group), a.id).toBe(true);
    for (const g of THEME_GROUPS) expect(THEMES.some((t) => t.group === g.id), g.id).toBe(true);
    for (const g of AMBIENCE_GROUPS) expect(AMBIENCES.some((a) => a.group === g.id), g.id).toBe(true);
  });

  it("offers the new themes and ambiences, and keeps the old ids (rooms saved with them still play)", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(16);
    expect(AMBIENCES.length).toBeGreaterThanOrEqual(18);
    for (const id of ["explore", "tension", "combat", "mystery", "tavern", "victory"]) expect(isThemeId(id), id).toBe(true);
    for (const id of ["rain", "storm", "wind", "fire", "forest", "dungeon", "tavern", "ocean"]) expect(isAmbienceId(id), id).toBe(true);
  });

  it("every theme has a finite length when played once", () => {
    for (const t of THEMES) {
      const seconds = themeSeconds(t.id);
      expect(seconds, t.id).toBeGreaterThan(5);
      expect(seconds, t.id).toBeLessThan(300);
    }
  });
});

describe("voice effects", () => {
  it("lists unique voices, starting with the natural one", () => {
    expect(VOICE_EFFECTS[0].id).toBe("none");
    expect(unique(VOICE_EFFECTS.map((e) => e.id))).toBe(true);
    expect(isVoiceEffectId("dragon")).toBe(true);
    expect(isVoiceEffectId("banana")).toBe(false);
  });

  it("sweeps the delay up to lower the pitch and down to raise it, by the ratio's distance from 1", () => {
    expect(pitchSweep(0.5, 0.08)).toEqual({ depth: 0.04, rising: true });
    const up = pitchSweep(1.5, 0.08);
    expect(up.rising).toBe(false);
    expect(up.depth).toBeCloseTo(0.04);
  });

  it("soft-clips: odd, bounded by ±1, through zero", () => {
    const curve = driveCurve(4, 101);
    expect(curve[0]).toBeCloseTo(-1);
    expect(curve[100]).toBeCloseTo(1);
    expect(curve[50]).toBeCloseTo(0);
    expect(curve[25]).toBeCloseTo(-curve[75]);
    expect(Math.max(...curve.map(Math.abs))).toBeLessThanOrEqual(1);
  });
});
