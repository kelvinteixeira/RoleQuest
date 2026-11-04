import type { LightDef } from "./map-document";

/** A light to draw: a burning prop or a light carried by a token. */
export interface LightSpot extends Pick<LightDef, "radius" | "color" | "flicker"> {
  key: string;
  x: number;
  y: number;
  /** Height above the square's floor. */
  height: number;
}

/**
 * Point lights come from a fixed pool: three.js compiles the light count into
 * every lit material, so a changing count (a torch lit, a room explored)
 * would recompile them all, and an unbounded count can exceed mobile GPU limits.
 */
export const LIGHT_POOL = 12;

/** The spots that get a light: carried ones first, then the map's fires closest to `focus`. */
export function pickLights(carried: LightSpot[], fixed: LightSpot[], focus: { x: number; y: number }): LightSpot[] {
  const d = (s: LightSpot) => (s.x - focus.x) ** 2 + (s.y - focus.y) ** 2;
  return [...carried, ...[...fixed].sort((a, b) => d(a) - d(b))].slice(0, LIGHT_POOL);
}
