import { describe, expect, it } from "vitest";
import { backgroundPlane, gridForBackground, suggestedColumns, type MapBackground } from "./background";
import { createBlankMap } from "./map-document";

const bg = (patch: Partial<MapBackground> = {}): MapBackground => ({ imageId: "img", width: 2000, height: 1000, cols: 20, offsetX: 0, offsetY: 0, opacity: 1, ...patch });

describe("map background", () => {
  it("sizes the grid from the squares across and the picture's proportions", () => {
    expect(gridForBackground(bg())).toEqual({ cols: 20, rows: 10 });
    expect(gridForBackground(bg({ cols: 25, width: 1000, height: 1500 }))).toEqual({ cols: 25, rows: 38 });
    // Clamped to the map limits.
    expect(gridForBackground(bg({ cols: 100 }))).toEqual({ cols: 64, rows: 50 });
  });

  it("suggests ~30 columns but keeps tall pictures within 64 rows", () => {
    expect(suggestedColumns(2048, 1536)).toBe(30);
    expect(suggestedColumns(800, 2048)).toBe(25);
  });

  it("covers the grid from its top-left corner, shifted by the fine offset", () => {
    const doc = createBlankMap(20, 10);
    expect(backgroundPlane(doc, bg())).toEqual({ center: [0, 0], size: [20, 10] });
    expect(backgroundPlane(doc, bg({ offsetX: 0.5, offsetY: -0.25 })).center).toEqual([0.5, -0.25]);
  });
});

describe("columns range", () => {
  it("keeps both sides of the grid within 8..64 squares", async () => {
    const { columnRange, clampColumns } = await import("./background");
    expect(columnRange(2000, 1000)).toEqual({ min: 16, max: 64 });
    expect(columnRange(800, 2048)).toEqual({ min: 8, max: 25 });
    expect(clampColumns(3, 2000, 1000)).toBe(16);
    expect(clampColumns(90, 800, 2048)).toBe(25);
  });
});
