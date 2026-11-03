/**
 * Starter maps built with the same operations the editor uses,
 * so they double as a test of the shape tools.
 */
import { createBlankMap, type MapDocument } from "./map-document";
import { ellipseCells, eraseCells, lineCells, paintTerrain, placeProps, rectCells, shiftElevation } from "./shapes";

const TREES = ["tree-common", "tree-round", "pine", "pine-tall", "oak"];
const UNDERGROWTH = ["bush", "fern", "grass-tall", "bush-flowers", "plant-big"];

export function riverGladeMap(): MapDocument {
  let m = createBlankMap(32, 22, "grass", "Clareira do rio");
  // Forest edges.
  m = paintTerrain(m, rectCells({ x: 0, y: 0 }, { x: 31, y: 3 }), "forest-floor");
  m = paintTerrain(m, rectCells({ x: 0, y: 18 }, { x: 31, y: 21 }), "forest-floor");
  m = placeProps(m, rectCells({ x: 0, y: 0 }, { x: 31, y: 2 }), TREES, 0.55, 3);
  m = placeProps(m, rectCells({ x: 0, y: 19 }, { x: 31, y: 21 }), TREES, 0.55, 5);
  m = placeProps(m, rectCells({ x: 0, y: 3 }, { x: 31, y: 3 }), UNDERGROWTH, 0.4, 9);
  m = placeProps(m, rectCells({ x: 0, y: 18 }, { x: 31, y: 18 }), UNDERGROWTH, 0.4, 11);
  // River: shallow banks around a deep channel.
  m = paintTerrain(m, lineCells({ x: 19, y: 0 }, { x: 14, y: 21 }, 3), "shallow-water");
  m = paintTerrain(m, lineCells({ x: 19, y: 0 }, { x: 14, y: 21 }, 1), "deep-water");
  m = placeProps(m, [{ x: 18, y: 4 }, { x: 15, y: 16 }], ["lily"]);
  // Road with a bridge over the river.
  m = paintTerrain(m, lineCells({ x: 0, y: 11 }, { x: 31, y: 10 }, 1), "dirt");
  const crossing = lineCells({ x: 0, y: 11 }, { x: 31, y: 10 }, 1).filter((c) => c.x >= 15 && c.x <= 18);
  m = paintTerrain(m, crossing, "deep-water");
  m = placeProps(m, crossing, ["bridge"]);
  m = { ...m, props: m.props.map((p) => (p.propId === "bridge" ? { ...p, rotation: 90 } : p)) };
  // Rocky plateau with a cave in the north-east.
  m = paintTerrain(m, ellipseCells({ x: 24, y: 2 }, { x: 31, y: 8 }), "rock");
  m = shiftElevation(m, ellipseCells({ x: 24, y: 2 }, { x: 31, y: 8 }), 1);
  m = eraseCells(m, rectCells({ x: 26, y: 8 }, { x: 26, y: 9 }), "stone");
  m = placeProps(m, [{ x: 26, y: 8 }], ["cave-entrance"]);
  m = placeProps(m, [{ x: 23, y: 5 }, { x: 25, y: 9 }, { x: 29, y: 9 }], ["rock-large", "rock-tall", "stone-large"]);
  // Campsite.
  m = paintTerrain(m, ellipseCells({ x: 3, y: 13 }, { x: 7, y: 16 }), "dirt");
  m = placeProps(m, [{ x: 5, y: 14 }], ["campfire"]);
  m = placeProps(m, [{ x: 3, y: 16 }], ["tent"]);
  m = placeProps(m, [{ x: 7, y: 13 }], ["log"]);
  m = placeProps(m, rectCells({ x: 9, y: 5 }, { x: 13, y: 16 }), ["rock-medium", "bush", "grass-tall", "mushroom"], 0.08, 21);
  return m;
}

export function caveMap(): MapDocument {
  let m = createBlankMap(30, 20, "cave-wall", "Caverna das águas");
  const floor = [
    ...ellipseCells({ x: 2, y: 6 }, { x: 10, y: 14 }),
    ...ellipseCells({ x: 12, y: 3 }, { x: 22, y: 11 }),
    ...ellipseCells({ x: 18, y: 10 }, { x: 27, y: 17 }),
    ...lineCells({ x: 6, y: 10 }, { x: 16, y: 7 }, 2),
    ...lineCells({ x: 18, y: 8 }, { x: 22, y: 13 }, 2),
    ...lineCells({ x: 0, y: 10 }, { x: 4, y: 10 }, 2),
  ];
  m = paintTerrain(m, floor, "cave-floor");
  m = shiftElevation(m, ellipseCells({ x: 2, y: 6 }, { x: 10, y: 14 }), 0);
  m = paintTerrain(m, ellipseCells({ x: 14, y: 5 }, { x: 19, y: 9 }), "shallow-water");
  m = paintTerrain(m, ellipseCells({ x: 15, y: 6 }, { x: 18, y: 8 }), "deep-water");
  m = placeProps(m, ellipseCells({ x: 18, y: 10 }, { x: 27, y: 17 }), ["stone-tall", "pebbles", "mushrooms-red", "mushroom"], 0.14, 4);
  m = placeProps(m, ellipseCells({ x: 2, y: 6 }, { x: 10, y: 14 }), ["pebbles", "mushroom", "stone-large"], 0.1, 8);
  m = placeProps(m, [{ x: 24, y: 13 }], ["obelisk"]);
  return m;
}

export function blankMap(): MapDocument {
  return createBlankMap(30, 20, "grass", "Mapa em branco");
}

export const MAP_TEMPLATES = [
  { id: "river-glade", label: "Clareira do rio", description: "Floresta, rio com ponte, estrada, acampamento e caverna.", build: riverGladeMap },
  { id: "cave", label: "Caverna das águas", description: "Galerias, lago subterrâneo e cogumelos.", build: caveMap },
  { id: "blank", label: "Em branco", description: "Grama, 30 × 20, para criar do zero.", build: blankMap },
] as const;
