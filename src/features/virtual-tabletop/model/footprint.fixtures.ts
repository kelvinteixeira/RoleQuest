import { createBlankMap, type MapDocument } from "@/features/map/model/map-document";
import { paintTerrain } from "@/features/map/model/shapes";

export { createBlankMap };

/** A wall down column `x`, with openings between the given rows (inclusive). */
export function paintWall(map: MapDocument, x: number, gaps: { from: number; to: number }[]): MapDocument {
  const cells = Array.from({ length: map.rows }, (_, y) => ({ x, y })).filter((c) => !gaps.some((g) => c.y >= g.from && c.y <= g.to));
  return paintTerrain(map, cells, "stone-wall");
}
