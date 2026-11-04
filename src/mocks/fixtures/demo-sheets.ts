/**
 * Filled-in sheets for the demo characters, so the table plays like a real
 * campaign (attributes, trained skills, armor, weapons). Imported ONLY by the
 * mock seed and its migration. Structure only — no rulebook text.
 */
import { ensureSheet, summarizeResources } from "@/features/character-sheet/model/sheet";
import { getBuiltInSystem, isBuiltInSystemId } from "@/features/systems/templates";
import type { Character, CharacterSheet, SheetAttack } from "@/types/character";

interface DemoAttack {
  name: string;
  attributeKey: string | null;
  skillKey?: string;
  damage: string;
  range?: number;
  bonus?: number;
}

interface DemoSpec {
  attributes: Record<string, number>;
  /** d20 systems: trained skills. */
  trained?: string[];
  /** Skill values (bonus, %, dots…). */
  skills?: Record<string, number>;
  resources?: Record<string, { current: number; max: number }>;
  defense?: number | null;
  armor?: number;
  speed?: number;
  attacks: DemoAttack[];
  inventory?: { name: string; slot?: string; weight?: number }[];
}

const DEMO: Record<string, DemoSpec> = {
  ch_isolde: {
    attributes: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 16 },
    trained: ["atletismo", "intimidacao", "persuasao", "religiao"],
    defense: 18,
    attacks: [
      { name: "Espada longa", attributeKey: "str", damage: "1d8+@mod" },
      { name: "Azagaia", attributeKey: "str", damage: "1d6+@mod", range: 6 },
    ],
    inventory: [
      { name: "Cota de malha", slot: "Armadura", weight: 25 },
      { name: "Escudo", slot: "Escudo", weight: 3 },
      { name: "Espada longa", slot: "Mão principal", weight: 1.5 },
    ],
  },
  ch_grom: {
    attributes: { str: 17, dex: 12, con: 16, int: 10, wis: 11, cha: 8 },
    trained: ["atletismo", "intimidacao", "percepcao", "sobrevivencia"],
    defense: 17,
    speed: 5,
    attacks: [
      { name: "Machado grande", attributeKey: "str", damage: "1d12+@mod" },
      { name: "Machadinha", attributeKey: "str", damage: "1d6+@mod", range: 4 },
    ],
    inventory: [
      { name: "Cota de malha", slot: "Armadura", weight: 25 },
      { name: "Machado grande", slot: "Mão principal", weight: 3.5 },
    ],
  },
  ch_nyx: {
    attributes: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 17 },
    trained: ["arcanismo", "enganacao", "intimidacao", "persuasao"],
    defense: null,
    attacks: [
      { name: "Raio de fogo", attributeKey: "cha", damage: "2d10", range: 24 },
      { name: "Adaga", attributeKey: "dex", damage: "1d4+@mod" },
    ],
  },
  ch_fen: {
    attributes: { str: 12, dex: 17, con: 13, int: 10, wis: 14, cha: 10 },
    trained: ["atletismo", "furtividade", "percepcao", "sobrevivencia"],
    defense: 15,
    attacks: [
      { name: "Arco longo", attributeKey: "dex", damage: "1d8+@mod", range: 30, bonus: 2 },
      { name: "Espada curta", attributeKey: "dex", damage: "1d6+@mod" },
    ],
    inventory: [
      { name: "Couro batido", slot: "Armadura", weight: 6.5 },
      { name: "Arco longo", slot: "Mão principal", weight: 1 },
    ],
  },
  ch_bryn: {
    attributes: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
    trained: ["acrobacia", "atuacao", "enganacao", "persuasao", "prestidigitacao"],
    defense: 13,
    speed: 5,
    attacks: [
      { name: "Rapieira", attributeKey: "dex", damage: "1d8+@mod" },
      { name: "Besta leve", attributeKey: "dex", damage: "1d8+@mod", range: 16 },
    ],
  },
  ch_kael: {
    attributes: { int: 5, ref: 8, dex: 7, tech: 4, cool: 7, will: 6, luck: 5, move: 6, body: 7, emp: 4 },
    skills: { "armas-curtas": 6, briga: 4, esquiva: 5, percepcao: 4, atletismo: 3 },
    armor: 11,
    attacks: [
      { name: "Pistola pesada", attributeKey: "ref", skillKey: "armas-curtas", damage: "3d6", range: 25 },
      { name: "Briga", attributeKey: "dex", skillKey: "briga", damage: "1d6" },
    ],
  },
  ch_celeste: {
    attributes: { strength: 2, dexterity: 3, stamina: 2, charisma: 4, manipulation: 3, composure: 3, intelligence: 3, wits: 3, resolve: 2 },
    skills: { "armas-brancas": 2, briga: 1, atletismo: 2, etiqueta: 3, persuasao: 3, subterfugio: 2 },
    attacks: [
      { name: "Navalha de prata", attributeKey: "dexterity", skillKey: "armas-brancas", damage: "1" },
      { name: "Briga", attributeKey: "strength", skillKey: "briga", damage: "0" },
    ],
  },
  ch_tomas: {
    attributes: { agi: 2, for: 1, int: 3, pre: 2, vig: 2 },
    skills: { pontaria: 5, investigacao: 10, percepcao: 5, reflexos: 5, ocultismo: 5 },
    resources: { pv: { current: 22, max: 30 }, san: { current: 14, max: 24 } },
    attacks: [
      { name: "Revólver", attributeKey: "agi", skillKey: "pontaria", damage: "2d6", range: 12 },
      { name: "Faca", attributeKey: "for", skillKey: "luta", damage: "1d4" },
    ],
  },
};

export const DEMO_SHEET_IDS = Object.keys(DEMO);

function buildSheet(character: Character, spec: DemoSpec): CharacterSheet | null {
  if (!isBuiltInSystemId(character.systemId)) return null;
  const sheet = ensureSheet(character, getBuiltInSystem(character.systemId));
  const skills = { ...sheet.skills };
  for (const key of spec.trained ?? []) skills[key] = { ...skills[key], trained: true };
  for (const [key, bonus] of Object.entries(spec.skills ?? {})) skills[key] = { ...skills[key], bonus };
  const attacks: SheetAttack[] = spec.attacks.map((a, i) => ({
    id: `atk_${character.id}_${i + 1}`,
    name: a.name,
    attributeKey: a.attributeKey,
    skillKey: a.skillKey ?? null,
    proficient: true,
    bonus: a.bonus ?? 0,
    damage: a.damage,
    range: a.range ?? 1,
  }));
  return {
    ...sheet,
    attributes: { ...sheet.attributes, ...spec.attributes },
    skills,
    resources: { ...sheet.resources, ...spec.resources },
    combat: { defense: spec.defense ?? null, armor: spec.armor ?? 0, speed: spec.speed ?? sheet.combat.speed, attacks },
    inventory: (spec.inventory ?? []).map((item, i) => ({ id: `item_${character.id}_${i + 1}`, name: item.name, quantity: 1, weight: item.weight ?? 0, equipped: true, slot: item.slot ?? null, notes: "" })),
  };
}

/** The character with its demo sheet (and a matching resource summary); unchanged if it has no demo sheet. */
export function withDemoSheet(character: Character): Character {
  const spec = DEMO[character.id];
  const sheet = spec ? buildSheet(character, spec) : null;
  if (!sheet || !isBuiltInSystemId(character.systemId)) return character;
  return { ...character, sheet, resources: summarizeResources(getBuiltInSystem(character.systemId), sheet) };
}
