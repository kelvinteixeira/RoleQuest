/**
 * Starter maps built with the same operations the editor uses,
 * so they double as a test of the shape tools.
 */
import { createBlankMap, terrainAt, type MapDocument } from "./map-document";
import { ellipseCells, eraseCells, lineCells, paintTerrain, placeProps, placeSpawn, rectCells, shiftElevation } from "./shapes";
import { buildStructure } from "./buildings";

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

/** Stone rooms joined by corridors: doors, a locked gate and hidden traps — made for the fog of war. */
export function cryptMap(): MapDocument {
  let m = createBlankMap(32, 22, "cave-wall", "Cripta esquecida");
  const entrance = rectCells({ x: 2, y: 8 }, { x: 8, y: 14 });
  const hall = rectCells({ x: 13, y: 6 }, { x: 21, y: 16 });
  const vault = rectCells({ x: 25, y: 7 }, { x: 30, y: 15 });
  const cellar = rectCells({ x: 12, y: 18 }, { x: 22, y: 20 });
  m = paintTerrain(m, [...entrance, ...hall, ...vault, ...cellar], "stone");
  m = paintTerrain(m, [...lineCells({ x: 0, y: 11 }, { x: 1, y: 11 }), ...lineCells({ x: 9, y: 11 }, { x: 12, y: 11 }), ...lineCells({ x: 22, y: 11 }, { x: 24, y: 11 }), ...lineCells({ x: 17, y: 17 }, { x: 17, y: 17 })], "cave-floor");
  // Doors into the hall and the cellar; an iron gate (locked) in front of the vault.
  m = placeProps(m, [{ x: 10, y: 11 }, { x: 17, y: 17 }], ["door"]);
  m = placeProps(m, [{ x: 23, y: 11 }], ["gate"]);
  m = { ...m, props: m.props.map((p) => (p.propId === "gate" ? { ...p, door: { open: false, locked: true } } : p)) };
  // Hidden traps: one in the corridor, one guarding the vault.
  m = placeProps(m, [{ x: 12, y: 11 }], ["trap-spikes"]);
  m = placeProps(m, [{ x: 27, y: 11 }], ["trap-darts"]);
  // Dressing.
  m = placeProps(m, [{ x: 15, y: 8 }, { x: 19, y: 8 }, { x: 15, y: 14 }, { x: 19, y: 14 }], ["column"]);
  m = placeProps(m, [{ x: 29, y: 11 }], ["obelisk"]);
  m = paintTerrain(m, rectCells({ x: 19, y: 19 }, { x: 21, y: 20 }), "shallow-water");
  // Dark inside: torches at the entrance, braziers in the hall and the vault.
  m = placeProps(m, [{ x: 2, y: 8 }, { x: 8, y: 14 }], ["torch"]);
  m = placeProps(m, [{ x: 17, y: 7 }, { x: 17, y: 15 }, { x: 28, y: 8 }], ["brazier"]);
  m = { ...m, ambient: "dark" };
  m = placeProps(m, entrance, ["pebbles", "mushroom"], 0.08, 2);
  m = placeProps(m, cellar, ["mushrooms-red", "pebbles", "stone-tall"], 0.12, 6);
  return m;
}

const TOWNSFOLK = {
  guard: { name: "Guarda", concept: "Humano · guarda da vila", modelId: "warrior", color: "oklch(0.66 0.15 150)", attitude: "ally", stats: { hp: 16, defense: 15, attackBonus: 4, damage: "1d8+2", speed: 6, initiativeBonus: 1, attackName: "Lança" } },
  innkeeper: { name: "Taverneiro", concept: "Humano · dono da taverna", modelId: "barbarian", color: "oklch(0.75 0.12 85)", attitude: "neutral", stats: { hp: 9, defense: 11, attackBonus: 2, damage: "1d6", speed: 6, initiativeBonus: 0, attackName: "Caneca" } },
  priest: { name: "Sacerdote", concept: "Humano · servo do templo", modelId: "mage", color: "oklch(0.66 0.15 150)", attitude: "ally", stats: { hp: 12, defense: 12, attackBonus: 3, damage: "1d6+1", speed: 6, initiativeBonus: 0, attackName: "Chama sagrada", range: 6 } },
} as const;

/** A crossroads village: houses, a tavern, a temple, a market square and a farm, with townsfolk. */
export function villageMap(): MapDocument {
  let m = createBlankMap(40, 28, "grass", "Vilarejo da encruzilhada");
  // Woods around the edges.
  m = paintTerrain(m, [...rectCells({ x: 0, y: 0 }, { x: 39, y: 1 }), ...rectCells({ x: 0, y: 26 }, { x: 39, y: 27 })], "forest-floor");
  m = placeProps(m, [...rectCells({ x: 0, y: 0 }, { x: 39, y: 1 }), ...rectCells({ x: 0, y: 26 }, { x: 39, y: 27 })], TREES, 0.5, 17);
  // Roads crossing at the square.
  m = paintTerrain(m, [...lineCells({ x: 0, y: 14 }, { x: 39, y: 14 }, 2), ...lineCells({ x: 20, y: 2 }, { x: 20, y: 25 }, 2)], "dirt");
  m = buildStructure(m, "square", { x: 16, y: 10 }, { x: 24, y: 18 });
  m = buildStructure(m, "tavern", { x: 3, y: 4 }, { x: 11, y: 11 });
  m = buildStructure(m, "house", { x: 13, y: 5 }, { x: 17, y: 9 });
  m = buildStructure(m, "house", { x: 23, y: 5 }, { x: 27, y: 9 });
  m = buildStructure(m, "temple", { x: 29, y: 3 }, { x: 35, y: 11 });
  m = buildStructure(m, "house", { x: 4, y: 18 }, { x: 9, y: 23 });
  m = buildStructure(m, "farm", { x: 26, y: 18 }, { x: 35, y: 24 }, 5);
  m = buildStructure(m, "house", { x: 12, y: 19 }, { x: 16, y: 23 });
  // Shrubs only on open grass: scattering replaces whatever stands on a square.
  const open = rectCells({ x: 0, y: 2 }, { x: 39, y: 25 }).filter((c) => terrainAt(m, c.x, c.y).id === "grass" && !m.props.some((p) => p.x === c.x && p.y === c.y));
  m = placeProps(m, open, ["bush", "grass-tall", "bush-flowers"], 0.04, 23);
  // Townsfolk (they join the table as tokens when the map is applied).
  m = placeSpawn(m, { x: 7, y: 9 }, { ...TOWNSFOLK.innkeeper, stats: { ...TOWNSFOLK.innkeeper.stats } });
  m = placeSpawn(m, { x: 32, y: 6 }, { ...TOWNSFOLK.priest, stats: { ...TOWNSFOLK.priest.stats } });
  m = placeSpawn(m, { x: 19, y: 15 }, { ...TOWNSFOLK.guard, stats: { ...TOWNSFOLK.guard.stats } });
  m = placeSpawn(m, { x: 22, y: 13 }, { ...TOWNSFOLK.guard, stats: { ...TOWNSFOLK.guard.stats } });
  return m;
}

/** A walled castle with a keep and throne room, on a hill road. */
export function castleMap(): MapDocument {
  let m = createBlankMap(34, 30, "grass", "Castelo do vale");
  m = paintTerrain(m, lineCells({ x: 17, y: 25 }, { x: 17, y: 29 }, 2), "dirt");
  m = buildStructure(m, "castle", { x: 5, y: 3 }, { x: 29, y: 25 });
  m = placeProps(m, [...rectCells({ x: 0, y: 0 }, { x: 3, y: 29 }), ...rectCells({ x: 31, y: 0 }, { x: 33, y: 29 })], ["pine", "pine-tall", "tree-common"], 0.45, 9);
  m = placeSpawn(m, { x: 17, y: 23 }, { ...TOWNSFOLK.guard, stats: { ...TOWNSFOLK.guard.stats } });
  m = placeSpawn(m, { x: 15, y: 23 }, { ...TOWNSFOLK.guard, stats: { ...TOWNSFOLK.guard.stats } });
  return { ...m, ambient: "dim" };
}

export function blankMap(): MapDocument {
  return createBlankMap(30, 20, "grass", "Mapa em branco");
}

export const MAP_TEMPLATES = [
  { id: "river-glade", label: "Clareira do rio", description: "Floresta, rio com ponte, estrada, acampamento e caverna.", build: riverGladeMap },
  { id: "cave", label: "Caverna das águas", description: "Galerias, lago subterrâneo e cogumelos.", build: caveMap },
  { id: "crypt", label: "Cripta esquecida", description: "Salas de pedra, portas, grade trancada e armadilhas ocultas. Boa para névoa de guerra.", build: cryptMap },
  { id: "village", label: "Vilarejo da encruzilhada", description: "Taverna, casas, templo, praça com feira, fazenda e moradores.", build: villageMap },
  { id: "castle", label: "Castelo do vale", description: "Muralha, torres, portão, pátio e fortaleza com sala do trono. Guardas no portão.", build: castleMap },
  { id: "blank", label: "Em branco", description: "Grama, 30 × 20, para criar do zero.", build: blankMap },
] as const;
