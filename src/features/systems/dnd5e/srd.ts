/**
 * D&D 5e game content from the System Reference Document 5.1 (CC-BY-4.0,
 * Wizards of the Coast): races, classes, the SRD background, armor and
 * spell-slot tables. Names are translated and descriptions are short
 * summaries written here; nothing outside the SRD is included.
 *
 * Ability keys follow the dnd5e template: str, dex, con, int, wis, cha.
 * Skill keys follow its skill list (atletismo, furtividade, percepcao…).
 */

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_LABEL: Record<Ability, string> = { str: "Força", dex: "Destreza", con: "Constituição", int: "Inteligência", wis: "Sabedoria", cha: "Carisma" };
export const ABILITY_ABBR: Record<Ability, string> = { str: "FOR", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR" };

export const ALL_SKILLS = [
  "acrobacia",
  "arcanismo",
  "atletismo",
  "atuacao",
  "enganacao",
  "furtividade",
  "historia",
  "intimidacao",
  "intuicao",
  "investigacao",
  "lidar-com-animais",
  "medicina",
  "natureza",
  "percepcao",
  "persuasao",
  "prestidigitacao",
  "religiao",
  "sobrevivencia",
] as const;
export type SkillKey = (typeof ALL_SKILLS)[number];

export interface Trait {
  name: string;
  summary: string;
}

export interface Race {
  key: string;
  label: string;
  /** Fixed ability increases. */
  bonuses: Partial<Record<Ability, number>>;
  /** Extra +1 increases the player picks (half-elf: two, not Charisma). */
  chooseBonuses?: { count: number; amount: number; exclude: Ability[] };
  /** Feet per round. */
  speed: number;
  /** Extra hit points per level (hill dwarf). */
  hpPerLevel?: number;
  skills?: SkillKey[];
  /** Skills of the player's choice (half-elf). */
  chooseSkills?: number;
  traits: Trait[];
}

export type ArmorCategory = "light" | "medium" | "heavy";
export type Caster = "full" | "half" | "pact";

export interface StartingAttack {
  name: string;
  ability: Ability;
  /** Damage dice; the ability modifier is added (`+@mod`). */
  dice: string;
  /** Squares (5 ft each); 1 = melee. */
  range: number;
}

export interface DndClass {
  key: string;
  label: string;
  hitDie: number;
  saves: Ability[];
  skillChoices: { count: number; from: readonly SkillKey[] };
  armor: ArmorCategory[];
  shields: boolean;
  /** Unarmored Defense: 10 + DEX + this ability (barbarian CON, monk WIS). */
  unarmored?: Ability;
  /** The monk's unarmored defense doesn't allow a shield. */
  unarmoredNoShield?: boolean;
  spellcasting?: { ability: Ability; caster: Caster };
  attack: StartingAttack;
  /** Level 1 features. */
  features: Trait[];
  /** Ability to raise first in the standard array suggestion. */
  primary: Ability[];
}

export interface Background {
  key: string;
  label: string;
  /** Fixed proficiencies; a custom background picks `chooseSkills` instead. */
  skills: SkillKey[];
  chooseSkills?: number;
  feature?: Trait;
}

export interface Armor {
  key: string;
  label: string;
  category: ArmorCategory | "none";
  base: number;
  /** null: full DEX; 0: none (heavy); 2: medium cap. */
  dexCap: number | null;
}

/* ---------- Races ---------- */

const DARKVISION: Trait = { name: "Visão no escuro", summary: "Enxerga na penumbra a até 18 m como se fosse luz plena, e no escuro como penumbra." };

export const RACES: Race[] = [
  {
    key: "anao-da-colina",
    label: "Anão da colina",
    bonuses: { con: 2, wis: 1 },
    speed: 25,
    hpPerLevel: 1,
    traits: [
      DARKVISION,
      { name: "Resiliência anã", summary: "Vantagem em resistências contra veneno e resistência a dano de veneno." },
      { name: "Treinamento anão", summary: "Proficiência com machados e martelos de guerra; armadura pesada não reduz o deslocamento." },
      { name: "Robustez anã", summary: "+1 PV máximo por nível." },
    ],
  },
  {
    key: "alto-elfo",
    label: "Alto elfo",
    bonuses: { dex: 2, int: 1 },
    speed: 30,
    skills: ["percepcao"],
    traits: [
      DARKVISION,
      { name: "Sentidos aguçados", summary: "Proficiência em Percepção." },
      { name: "Ancestral feérico", summary: "Vantagem contra ficar enfeitiçado; magia não o faz dormir." },
      { name: "Transe", summary: "Medita 4 horas no lugar de dormir 8." },
      { name: "Truque", summary: "Conhece um truque de mago (Inteligência)." },
    ],
  },
  {
    key: "halfling-pes-leves",
    label: "Halfling pés-leves",
    bonuses: { dex: 2, cha: 1 },
    speed: 25,
    traits: [
      { name: "Sortudo", summary: "Ao tirar 1 natural num ataque, teste ou resistência, rola de novo." },
      { name: "Bravura", summary: "Vantagem contra ficar amedrontado." },
      { name: "Agilidade halfling", summary: "Passa pelo espaço de criaturas maiores." },
      { name: "Furtividade natural", summary: "Pode se esconder atrás de uma criatura maior que ele." },
    ],
  },
  {
    key: "humano",
    label: "Humano",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    traits: [{ name: "Versátil", summary: "+1 em todos os atributos." }],
  },
  {
    key: "draconato",
    label: "Draconato",
    bonuses: { str: 2, cha: 1 },
    speed: 30,
    traits: [
      { name: "Ancestral dracônico", summary: "Escolha um tipo de dragão: define o dano do sopro e a resistência." },
      { name: "Arma de sopro", summary: "Uma ação: 2d6 de dano numa área (resistência de CD 8 + CON + proficiência). Recarrega no descanso." },
      { name: "Resistência a dano", summary: "Resistência ao tipo de dano do seu ancestral." },
    ],
  },
  {
    key: "gnomo-das-rochas",
    label: "Gnomo das rochas",
    bonuses: { int: 2, con: 1 },
    speed: 25,
    traits: [
      DARKVISION,
      { name: "Esperteza gnômica", summary: "Vantagem em resistências de INT, SAB e CAR contra magia." },
      { name: "Conhecimento de artífice", summary: "Dobra a proficiência em História sobre itens mágicos e engenhocas." },
      { name: "Engenhoqueiro", summary: "Constrói pequenos mecanismos com ferramentas de funileiro." },
    ],
  },
  {
    key: "meio-elfo",
    label: "Meio-elfo",
    bonuses: { cha: 2 },
    chooseBonuses: { count: 2, amount: 1, exclude: ["cha"] },
    speed: 30,
    chooseSkills: 2,
    traits: [
      DARKVISION,
      { name: "Ancestral feérico", summary: "Vantagem contra ficar enfeitiçado; magia não o faz dormir." },
      { name: "Versatilidade em perícias", summary: "Proficiência em duas perícias à escolha." },
    ],
  },
  {
    key: "meio-orc",
    label: "Meio-orc",
    bonuses: { str: 2, con: 1 },
    speed: 30,
    skills: ["intimidacao"],
    traits: [
      DARKVISION,
      { name: "Ameaçador", summary: "Proficiência em Intimidação." },
      { name: "Resistência implacável", summary: "Uma vez por descanso longo, ao cair a 0 PV fica com 1." },
      { name: "Ataques selvagens", summary: "Num crítico corpo a corpo, rola mais um dado de dano da arma." },
    ],
  },
  {
    key: "tiefling",
    label: "Tiefling",
    bonuses: { cha: 2, int: 1 },
    speed: 30,
    traits: [
      DARKVISION,
      { name: "Resistência infernal", summary: "Resistência a dano de fogo." },
      { name: "Legado infernal", summary: "Conhece o truque Taumaturgia; mais magias inatas nos níveis 3 e 5 (Carisma)." },
    ],
  },
];

/* ---------- Classes ---------- */

export const CLASSES: DndClass[] = [
  {
    key: "barbaro",
    label: "Bárbaro",
    hitDie: 12,
    saves: ["str", "con"],
    skillChoices: { count: 2, from: ["lidar-com-animais", "atletismo", "intimidacao", "natureza", "percepcao", "sobrevivencia"] },
    armor: ["light", "medium"],
    shields: true,
    unarmored: "con",
    attack: { name: "Machado grande", ability: "str", dice: "1d12", range: 1 },
    features: [
      { name: "Fúria", summary: "Ação bônus: vantagem em testes de FOR, +2 de dano corpo a corpo e resistência a dano físico. 2 usos por descanso longo." },
      { name: "Defesa sem armadura", summary: "Sem armadura, CA = 10 + DES + CON (escudo permitido)." },
    ],
    primary: ["str", "con"],
  },
  {
    key: "bardo",
    label: "Bardo",
    hitDie: 8,
    saves: ["dex", "cha"],
    skillChoices: { count: 3, from: ALL_SKILLS },
    armor: ["light"],
    shields: false,
    spellcasting: { ability: "cha", caster: "full" },
    attack: { name: "Rapieira", ability: "dex", dice: "1d8", range: 1 },
    features: [
      { name: "Conjuração", summary: "Magias de bardo com Carisma." },
      { name: "Inspiração de bardo", summary: "Ação bônus: um aliado ganha 1d6 para somar a um teste. Usos = mod. de CAR." },
    ],
    primary: ["cha", "dex"],
  },
  {
    key: "clerigo",
    label: "Clérigo",
    hitDie: 8,
    saves: ["wis", "cha"],
    skillChoices: { count: 2, from: ["historia", "intuicao", "medicina", "persuasao", "religiao"] },
    armor: ["light", "medium"],
    shields: true,
    spellcasting: { ability: "wis", caster: "full" },
    attack: { name: "Maça", ability: "str", dice: "1d6", range: 1 },
    features: [
      { name: "Conjuração", summary: "Magias de clérigo com Sabedoria; prepara magias todo dia." },
      { name: "Domínio divino", summary: "Escolha um domínio (o SRD traz o da Vida): magias e poderes extras." },
    ],
    primary: ["wis", "con"],
  },
  {
    key: "druida",
    label: "Druida",
    hitDie: 8,
    saves: ["int", "wis"],
    skillChoices: { count: 2, from: ["arcanismo", "lidar-com-animais", "intuicao", "medicina", "natureza", "percepcao", "religiao", "sobrevivencia"] },
    armor: ["light", "medium"],
    shields: true,
    spellcasting: { ability: "wis", caster: "full" },
    attack: { name: "Cimitarra", ability: "dex", dice: "1d6", range: 1 },
    features: [
      { name: "Druídico", summary: "Conhece a língua secreta dos druidas." },
      { name: "Conjuração", summary: "Magias de druida com Sabedoria; prepara magias todo dia." },
    ],
    primary: ["wis", "con"],
  },
  {
    key: "guerreiro",
    label: "Guerreiro",
    hitDie: 10,
    saves: ["str", "con"],
    skillChoices: { count: 2, from: ["acrobacia", "lidar-com-animais", "atletismo", "historia", "intuicao", "intimidacao", "percepcao", "sobrevivencia"] },
    armor: ["light", "medium", "heavy"],
    shields: true,
    attack: { name: "Espada longa", ability: "str", dice: "1d8", range: 1 },
    features: [
      { name: "Estilo de luta", summary: "Escolha uma especialidade: arquearia, defesa, duelismo, armas grandes, proteção ou duas armas." },
      { name: "Retomar o fôlego", summary: "Ação bônus: recupera 1d10 + nível em PV. Uma vez por descanso." },
    ],
    primary: ["str", "con"],
  },
  {
    key: "monge",
    label: "Monge",
    hitDie: 8,
    saves: ["str", "dex"],
    skillChoices: { count: 2, from: ["acrobacia", "atletismo", "historia", "intuicao", "religiao", "furtividade"] },
    armor: [],
    shields: false,
    unarmored: "wis",
    unarmoredNoShield: true,
    attack: { name: "Espada curta", ability: "dex", dice: "1d6", range: 1 },
    features: [
      { name: "Defesa sem armadura", summary: "Sem armadura nem escudo, CA = 10 + DES + SAB." },
      { name: "Artes marciais", summary: "Golpes desarmados de 1d4 com DES e um golpe extra como ação bônus." },
    ],
    primary: ["dex", "wis"],
  },
  {
    key: "paladino",
    label: "Paladino",
    hitDie: 10,
    saves: ["wis", "cha"],
    skillChoices: { count: 2, from: ["atletismo", "intuicao", "intimidacao", "medicina", "persuasao", "religiao"] },
    armor: ["light", "medium", "heavy"],
    shields: true,
    spellcasting: { ability: "cha", caster: "half" },
    attack: { name: "Espada longa", ability: "str", dice: "1d8", range: 1 },
    features: [
      { name: "Sentido divino", summary: "Ação: percebe celestiais, corruptores e mortos-vivos próximos. Usos = 1 + mod. de CAR." },
      { name: "Cura pelas mãos", summary: "Reserva de cura igual a 5 × nível de paladino por descanso longo." },
    ],
    primary: ["str", "cha"],
  },
  {
    key: "patrulheiro",
    label: "Patrulheiro",
    hitDie: 10,
    saves: ["str", "dex"],
    skillChoices: { count: 3, from: ["lidar-com-animais", "atletismo", "intuicao", "investigacao", "natureza", "percepcao", "furtividade", "sobrevivencia"] },
    armor: ["light", "medium"],
    shields: true,
    spellcasting: { ability: "wis", caster: "half" },
    attack: { name: "Arco longo", ability: "dex", dice: "1d8", range: 30 },
    features: [
      { name: "Inimigo favorito", summary: "Vantagem para rastrear e lembrar fatos sobre um tipo de criatura." },
      { name: "Explorador natural", summary: "Em um tipo de terreno favorito, viaja e rastreia com mais eficiência." },
    ],
    primary: ["dex", "wis"],
  },
  {
    key: "ladino",
    label: "Ladino",
    hitDie: 8,
    saves: ["dex", "int"],
    skillChoices: { count: 4, from: ["acrobacia", "atletismo", "enganacao", "intuicao", "intimidacao", "investigacao", "percepcao", "atuacao", "persuasao", "prestidigitacao", "furtividade"] },
    armor: ["light"],
    shields: false,
    attack: { name: "Rapieira", ability: "dex", dice: "1d8", range: 1 },
    features: [
      { name: "Especialização", summary: "Dobra a proficiência em duas perícias." },
      { name: "Ataque furtivo", summary: "Uma vez por turno, +1d6 de dano com vantagem ou com um aliado ao lado do alvo." },
      { name: "Gíria de ladrão", summary: "Código secreto de sinais e jargões." },
    ],
    primary: ["dex", "int"],
  },
  {
    key: "feiticeiro",
    label: "Feiticeiro",
    hitDie: 6,
    saves: ["con", "cha"],
    skillChoices: { count: 2, from: ["arcanismo", "enganacao", "intuicao", "intimidacao", "persuasao", "religiao"] },
    armor: [],
    shields: false,
    spellcasting: { ability: "cha", caster: "full" },
    attack: { name: "Adaga", ability: "dex", dice: "1d4", range: 1 },
    features: [
      { name: "Conjuração", summary: "Magias de feiticeiro com Carisma." },
      { name: "Origem de feitiçaria", summary: "A fonte do seu poder (o SRD traz a linhagem dracônica)." },
    ],
    primary: ["cha", "con"],
  },
  {
    key: "bruxo",
    label: "Bruxo",
    hitDie: 8,
    saves: ["wis", "cha"],
    skillChoices: { count: 2, from: ["arcanismo", "enganacao", "historia", "intimidacao", "investigacao", "natureza", "religiao"] },
    armor: ["light"],
    shields: false,
    spellcasting: { ability: "cha", caster: "pact" },
    attack: { name: "Adaga", ability: "dex", dice: "1d4", range: 1 },
    features: [
      { name: "Patrono transcendental", summary: "Um pacto com um ser poderoso (o SRD traz o Corruptor)." },
      { name: "Magia de pacto", summary: "Poucos espaços de magia, sempre no nível mais alto, que voltam no descanso curto." },
    ],
    primary: ["cha", "con"],
  },
  {
    key: "mago",
    label: "Mago",
    hitDie: 6,
    saves: ["int", "wis"],
    skillChoices: { count: 2, from: ["arcanismo", "historia", "intuicao", "investigacao", "medicina", "religiao"] },
    armor: [],
    shields: false,
    spellcasting: { ability: "int", caster: "full" },
    attack: { name: "Bordão", ability: "str", dice: "1d6", range: 1 },
    features: [
      { name: "Conjuração", summary: "Magias de mago com Inteligência, a partir do grimório." },
      { name: "Recuperação arcana", summary: "Uma vez por dia, num descanso curto, recupera espaços de magia." },
    ],
    primary: ["int", "con"],
  },
];

/* ---------- Backgrounds ---------- */

export const BACKGROUNDS: Background[] = [
  {
    key: "acolito",
    label: "Acólito",
    skills: ["intuicao", "religiao"],
    feature: { name: "Abrigo dos fiéis", summary: "Templos da sua fé oferecem abrigo e ajuda modesta." },
  },
  { key: "personalizado", label: "Personalizado", skills: [], chooseSkills: 2 },
];

/* ---------- Armor ---------- */

export const ARMORS: Armor[] = [
  { key: "nenhuma", label: "Sem armadura", category: "none", base: 10, dexCap: null },
  { key: "acolchoada", label: "Acolchoada", category: "light", base: 11, dexCap: null },
  { key: "couro", label: "Couro", category: "light", base: 11, dexCap: null },
  { key: "couro-batido", label: "Couro batido", category: "light", base: 12, dexCap: null },
  { key: "gibao-de-peles", label: "Gibão de peles", category: "medium", base: 12, dexCap: 2 },
  { key: "camisao-de-malha", label: "Camisão de malha", category: "medium", base: 13, dexCap: 2 },
  { key: "brunea", label: "Brunea", category: "medium", base: 14, dexCap: 2 },
  { key: "peitoral", label: "Peitoral", category: "medium", base: 14, dexCap: 2 },
  { key: "meia-armadura", label: "Meia-armadura", category: "medium", base: 15, dexCap: 2 },
  { key: "cota-de-aneis", label: "Cota de anéis", category: "heavy", base: 14, dexCap: 0 },
  { key: "cota-de-malha", label: "Cota de malha", category: "heavy", base: 16, dexCap: 0 },
  { key: "cota-de-talas", label: "Cota de talas", category: "heavy", base: 17, dexCap: 0 },
  { key: "placas", label: "Placas", category: "heavy", base: 18, dexCap: 0 },
];

export const ARMOR_CATEGORY_LABEL: Record<ArmorCategory, string> = { light: "leve", medium: "média", heavy: "pesada" };

/* ---------- Spell slots (slots per spell level, 1st onwards) ---------- */

const FULL: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF: number[][] = [
  [],
  [2],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

/** Spell slots by spell level (index 0 = 1st level) for a caster type at a class level. */
export function spellSlots(caster: Caster, level: number): number[] {
  const lvl = Math.max(1, Math.min(20, Math.floor(level)));
  if (caster === "full") return FULL[lvl - 1];
  if (caster === "half") return HALF[lvl - 1];
  // Pact magic: a few slots, all of the highest level the warlock reaches.
  const count = lvl === 1 ? 1 : lvl <= 10 ? 2 : lvl <= 16 ? 3 : 4;
  const slotLevel = Math.min(5, Math.ceil(lvl / 2));
  return Array.from({ length: slotLevel }, (_, i) => (i === slotLevel - 1 ? count : 0));
}

/* ---------- Ability scores at creation ---------- */

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const raceByKey = (key: string | undefined) => RACES.find((r) => r.key === key);
export const classByKey = (key: string | undefined) => CLASSES.find((c) => c.key === key);
export const backgroundByKey = (key: string | undefined) => BACKGROUNDS.find((b) => b.key === key);
export const armorByKey = (key: string | undefined) => ARMORS.find((a) => a.key === key) ?? ARMORS[0];
