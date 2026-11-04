/**
 * A picture laid under the grid (an imported battle map). The map keeps only
 * a reference to the stored image; geometry is in squares, so it does not
 * depend on the image resolution.
 */
import { MAP_LIMITS, type MapDocument } from "./map-document";

export interface MapBackground {
  imageId: string;
  /** Stored image size in pixels (only the aspect ratio matters). */
  width: number;
  height: number;
  /** How many squares the image spans horizontally. */
  cols: number;
  /** Fine alignment of the picture against the grid, in squares. */
  offsetX: number;
  offsetY: number;
  opacity: number;
}

const clampCells = (n: number) => Math.max(MAP_LIMITS.min, Math.min(MAP_LIMITS.max, Math.round(n)));

/** Squares the image spans vertically, from its aspect ratio. */
export const backgroundRows = (bg: Pick<MapBackground, "width" | "height" | "cols">) => (bg.cols * bg.height) / bg.width;

/** Grid size that covers the picture. */
export function gridForBackground(bg: Pick<MapBackground, "width" | "height" | "cols">): { cols: number; rows: number } {
  return { cols: clampCells(bg.cols), rows: clampCells(backgroundRows(bg)) };
}

/** Squares across the picture may span: within the map limits both ways. */
export function columnRange(width: number, height: number): { min: number; max: number } {
  const max = Math.min(MAP_LIMITS.max, Math.floor((MAP_LIMITS.max * width) / height));
  const min = Math.min(max, Math.max(MAP_LIMITS.min, Math.ceil((MAP_LIMITS.min * width) / height)));
  return { min, max: Math.max(min, max) };
}

export const clampColumns = (cols: number, width: number, height: number) => {
  const { min, max } = columnRange(width, height);
  return Math.max(min, Math.min(max, Math.round(cols)));
};

/** A starting guess: about 30 squares across, within the limits. */
export function suggestedColumns(width: number, height: number): number {
  return clampColumns(30, width, height);
}

/** Plane centre and size in world units (1 square = 1 unit, map centred on the origin). */
export function backgroundPlane(doc: Pick<MapDocument, "cols" | "rows">, bg: MapBackground): { center: [number, number]; size: [number, number] } {
  const w = bg.cols;
  const h = backgroundRows(bg);
  return { center: [-doc.cols / 2 + bg.offsetX + w / 2, -doc.rows / 2 + bg.offsetY + h / 2], size: [w, h] };
}
