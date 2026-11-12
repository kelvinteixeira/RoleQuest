/**
 * More SRD 5.1 content (CC-BY-4.0): weapons, cantrips and 1st-level spells by
 * class, and class features from level 2 to 5. Names translated; no rules text.
 */
import type { Ability } from "./srd";

export type WeaponCategory = "simples" | "marcial";
export interface Weapon {
  key: string;
  label: string;
  category: WeaponCategory;
  ranged: boolean;
  dice: string;
  damageType: "contundente" | "cortante" | "perfurante";
  properties: string[];
  /** Normal range in feet (ranged and thrown weapons). */
  range?: number;
  finesse?: boolean;
  /** Reach: 10 ft. */
  reach?: boolean;
}

const w = (key: string, label: string, category: WeaponCategory, ranged: boolean, dice: string, damageType: Weapon["damageType"], properties: string[], extra: Partial<Weapon> = {}): Weapon => ({
  key,
  label,
  category,
  ranged,
  dice,
  damageType,
  properties,
  finesse: properties.includes("acuidade"),
  reach: properties.includes("alcance"),
  ...extra,
});

export const WEAPONS: Weapon[] = [
  w("clava", "Clava", "simples", false, "1d4", "contundente", ["leve"]),
  w("adaga", "Adaga", "simples", false, "1d4", "perfurante", ["acuidade", "leve", "arremesso (6/18 m)"], { range: 20 }),
  w("clava-grande", "Clava grande", "simples", false, "1d8", "contundente", ["duas mãos"]),
  w("machadinha", "Machadinha", "simples", false, "1d6", "cortante", ["leve", "arremesso (6/18 m)"], { range: 20 }),
  w("azagaia", "Azagaia", "simples", false, "1d6", "perfurante", ["arremesso (9/36 m)"], { range: 30 }),
  w("martelo-leve", "Martelo leve", "simples", false, "1d4", "contundente", ["leve", "arremesso (6/18 m)"], { range: 20 }),
  w("maca", "Maça", "simples", false, "1d6", "contundente", []),
  w("bordao", "Bordão", "simples", false, "1d6", "contundente", ["versátil (1d8)"]),
  w("foice", "Foice", "simples", false, "1d4", "cortante", ["leve"]),
  w("lanca", "Lança", "simples", false, "1d6", "perfurante", ["arremesso (6/18 m)", "versátil (1d8)"], { range: 20 }),
  w("besta-leve", "Besta leve", "simples", true, "1d8", "perfurante", ["munição (24/96 m)", "recarga", "duas mãos"], { range: 80 }),
  w("dardo", "Dardo", "simples", true, "1d4", "perfurante", ["acuidade", "arremesso (6/18 m)"], { range: 20 }),
  w("arco-curto", "Arco curto", "simples", true, "1d6", "perfurante", ["munição (24/96 m)", "duas mãos"], { range: 80 }),
  w("funda", "Funda", "simples", true, "1d4", "contundente", ["munição (9/36 m)"], { range: 30 }),
  w("machado-de-batalha", "Machado de batalha", "marcial", false, "1d8", "cortante", ["versátil (1d10)"]),
  w("mangual", "Mangual", "marcial", false, "1d8", "contundente", []),
  w("glaive", "Glaive", "marcial", false, "1d10", "cortante", ["pesada", "alcance", "duas mãos"]),
  w("machado-grande", "Machado grande", "marcial", false, "1d12", "cortante", ["pesada", "duas mãos"]),
  w("espada-grande", "Espada grande", "marcial", false, "2d6", "cortante", ["pesada", "duas mãos"]),
  w("alabarda", "Alabarda", "marcial", false, "1d10", "cortante", ["pesada", "alcance", "duas mãos"]),
  w("lanca-de-montaria", "Lança de montaria", "marcial", false, "1d12", "perfurante", ["alcance", "especial"]),
  w("espada-longa", "Espada longa", "marcial", false, "1d8", "cortante", ["versátil (1d10)"]),
  w("malho", "Malho", "marcial", false, "2d6", "contundente", ["pesada", "duas mãos"]),
  w("maca-estrela", "Maça-estrela", "marcial", false, "1d8", "perfurante", []),
  w("pique", "Pique", "marcial", false, "1d10", "perfurante", ["pesada", "alcance", "duas mãos"]),
  w("rapieira", "Rapieira", "marcial", false, "1d8", "perfurante", ["acuidade"]),
  w("cimitarra", "Cimitarra", "marcial", false, "1d6", "cortante", ["acuidade", "leve"]),
  w("espada-curta", "Espada curta", "marcial", false, "1d6", "perfurante", ["acuidade", "leve"]),
  w("tridente", "Tridente", "marcial", false, "1d6", "perfurante", ["arremesso (6/18 m)", "versátil (1d8)"], { range: 20 }),
  w("picareta-de-guerra", "Picareta de guerra", "marcial", false, "1d8", "perfurante", []),
  w("martelo-de-guerra", "Martelo de guerra", "marcial", false, "1d8", "contundente", ["versátil (1d10)"]),
  w("chicote", "Chicote", "marcial", false, "1d4", "cortante", ["acuidade", "alcance"]),
  w("zarabatana", "Zarabatana", "marcial", true, "1", "perfurante", ["munição (7,5/30 m)", "recarga"], { range: 25 }),
  w("besta-de-mao", "Besta de mão", "marcial", true, "1d6", "perfurante", ["munição (9/36 m)", "leve", "recarga"], { range: 30 }),
  w("besta-pesada", "Besta pesada", "marcial", true, "1d10", "perfurante", ["munição (30/120 m)", "pesada", "recarga", "duas mãos"], { range: 100 }),
  w("arco-longo", "Arco longo", "marcial", true, "1d8", "perfurante", ["munição (45/180 m)", "pesada", "duas mãos"], { range: 150 }),
];

/** Martial weapons each class is trained with (every class handles simple weapons, apart from the list ones). */
const MARTIAL_ALL = new Set(["barbaro", "guerreiro", "paladino", "patrulheiro"]);
const SOME: Record<string, string[]> = {
  bardo: ["besta-de-mao", "espada-longa", "rapieira", "espada-curta"],
  ladino: ["besta-de-mao", "espada-longa", "rapieira", "espada-curta"],
  monge: ["espada-curta"],
  druida: ["cimitarra"],
};
/** Classes trained with only some simple weapons. */
const SIMPLE_ONLY: Record<string, string[]> = {
  druida: ["clava", "adaga", "dardo", "azagaia", "maca", "bordao", "foice", "funda", "lanca"],
  feiticeiro: ["adaga", "dardo", "funda", "bordao", "besta-leve"],
  mago: ["adaga", "dardo", "funda", "bordao", "besta-leve"],
};

export function weaponProficient(classKey: string | undefined, weapon: Weapon): boolean {
  if (!classKey) return true;
  if (weapon.category === "marcial") return MARTIAL_ALL.has(classKey) || !!SOME[classKey]?.includes(weapon.key);
  return SIMPLE_ONLY[classKey] ? SIMPLE_ONLY[classKey].includes(weapon.key) : true;
}

/** The ability an attack uses: DEX at range, the better of STR/DEX with finesse, STR otherwise. */
export function weaponAbility(weapon: Weapon, scores: Partial<Record<Ability, number>>): Ability {
  if (weapon.ranged) return "dex";
  if (weapon.finesse && (scores.dex ?? 10) > (scores.str ?? 10)) return "dex";
  return "str";
}

/** Squares: reach weapons 2, ranged/thrown their normal range, melee 1. */
export const weaponRange = (weapon: Weapon) => (weapon.ranged ? Math.round((weapon.range ?? 30) / 5) : weapon.reach ? 2 : 1);

/* ---------- Spells (cantrips and 1st level) ---------- */

export interface Spell {
  label: string;
  level: 0 | 1;
  school: string;
  classes: string[];
}

const B = "bardo";
const C = "clerigo";
const D = "druida";
const P = "paladino";
const R = "patrulheiro";
const S = "feiticeiro";
const K = "bruxo";
const M = "mago";
const sp = (label: string, level: 0 | 1, school: string, classes: string[]): Spell => ({ label, level, school, classes });

export const SPELLS: Spell[] = [
  sp("Respingo Ácido", 0, "conjuração", [S, M]),
  sp("Toque Arrepiante", 0, "necromancia", [S, K, M]),
  sp("Luzes Dançantes", 0, "evocação", [B, S, M]),
  sp("Arte Druídica", 0, "transmutação", [D]),
  sp("Rajada Mística", 0, "evocação", [K]),
  sp("Raio de Fogo", 0, "evocação", [S, M]),
  sp("Orientação", 0, "adivinhação", [C, D]),
  sp("Luz", 0, "evocação", [B, C, S, M]),
  sp("Mãos Mágicas", 0, "conjuração", [B, S, K, M]),
  sp("Remendar", 0, "transmutação", [B, C, D, S, M]),
  sp("Mensagem", 0, "transmutação", [B, S, M]),
  sp("Ilusão Menor", 0, "ilusão", [B, S, K, M]),
  sp("Spray Venenoso", 0, "conjuração", [D, S, K, M]),
  sp("Prestidigitação", 0, "transmutação", [B, S, K, M]),
  sp("Produzir Chamas", 0, "conjuração", [D]),
  sp("Raio de Gelo", 0, "evocação", [S, M]),
  sp("Resistência", 0, "abjuração", [C, D]),
  sp("Chama Sagrada", 0, "evocação", [C]),
  sp("Bordão Místico", 0, "transmutação", [D]),
  sp("Toque Chocante", 0, "evocação", [S, M]),
  sp("Poupar os Moribundos", 0, "necromancia", [C]),
  sp("Taumaturgia", 0, "transmutação", [C]),
  sp("Golpe Certeiro", 0, "adivinhação", [B, S, K, M]),
  sp("Zombaria Viciosa", 0, "encantamento", [B]),
  sp("Alarme", 1, "abjuração", [R, M]),
  sp("Amizade Animal", 1, "encantamento", [B, D, R]),
  sp("Perdição", 1, "encantamento", [B, C]),
  sp("Bênção", 1, "encantamento", [C, P]),
  sp("Mãos Flamejantes", 1, "evocação", [S, M]),
  sp("Enfeitiçar Pessoa", 1, "encantamento", [B, D, S, K, M]),
  sp("Leque Cromático", 1, "ilusão", [S, M]),
  sp("Comando", 1, "encantamento", [C, P]),
  sp("Compreender Idiomas", 1, "adivinhação", [B, S, K, M]),
  sp("Criar ou Destruir Água", 1, "transmutação", [C, D]),
  sp("Curar Ferimentos", 1, "evocação", [B, C, D, P, R]),
  sp("Detectar o Bem e o Mal", 1, "adivinhação", [C, P]),
  sp("Detectar Magia", 1, "adivinhação", [B, C, D, P, R, S, M]),
  sp("Detectar Veneno e Doença", 1, "adivinhação", [C, D, P, R]),
  sp("Disfarçar-se", 1, "ilusão", [B, S, M]),
  sp("Favor Divino", 1, "evocação", [P]),
  sp("Constrição", 1, "conjuração", [D]),
  sp("Recuo Acelerado", 1, "transmutação", [S, K, M]),
  sp("Fogo das Fadas", 1, "evocação", [B, D]),
  sp("Vida Falsa", 1, "necromancia", [S, M]),
  sp("Queda Suave", 1, "transmutação", [B, S, M]),
  sp("Disco Flutuante", 1, "conjuração", [M]),
  sp("Névoa Obscurecente", 1, "conjuração", [D, R, S, M]),
  sp("Bom Fruto", 1, "transmutação", [D, R]),
  sp("Área Escorregadia", 1, "conjuração", [M]),
  sp("Raio Guiador", 1, "evocação", [C]),
  sp("Palavra Curativa", 1, "evocação", [B, C, D]),
  sp("Repreensão Infernal", 1, "evocação", [K]),
  sp("Heroísmo", 1, "encantamento", [B, P]),
  sp("Riso Histérico", 1, "encantamento", [B, M]),
  sp("Marca do Caçador", 1, "adivinhação", [R]),
  sp("Identificar", 1, "adivinhação", [B, M]),
  sp("Escrita Ilusória", 1, "ilusão", [B, K, M]),
  sp("Infligir Ferimentos", 1, "necromancia", [C]),
  sp("Salto", 1, "transmutação", [D, R, S, M]),
  sp("Passos Longos", 1, "transmutação", [B, D, R, M]),
  sp("Armadura Arcana", 1, "abjuração", [S, M]),
  sp("Mísseis Mágicos", 1, "evocação", [S, M]),
  sp("Proteção contra o Bem e o Mal", 1, "abjuração", [C, P, K, M]),
  sp("Purificar Alimentos", 1, "transmutação", [C, D, P]),
  sp("Santuário", 1, "abjuração", [C]),
  sp("Escudo Arcano", 1, "abjuração", [S, M]),
  sp("Escudo da Fé", 1, "abjuração", [C, P]),
  sp("Imagem Silenciosa", 1, "ilusão", [B, S, M]),
  sp("Sono", 1, "encantamento", [B, S, M]),
  sp("Falar com Animais", 1, "adivinhação", [B, D, R]),
  sp("Onda Trovejante", 1, "evocação", [B, D, S, M]),
  sp("Servo Invisível", 1, "conjuração", [B, K, M]),
];

/* ---------- Class features, levels 2 to 5 ---------- */

const ASI = "Aumento no valor de atributo";
export const FEATURES_BY_LEVEL: Record<string, Record<number, string[]>> = {
  barbaro: { 2: ["Ataque descuidado", "Sentido de perigo"], 3: ["Caminho primitivo"], 4: [ASI], 5: ["Ataque extra", "Movimento rápido"] },
  bardo: { 2: ["Versatilidade", "Canção de descanso"], 3: ["Colégio de bardo", "Especialização"], 4: [ASI], 5: ["Fonte de inspiração", "Inspiração de bardo (d8)"] },
  clerigo: { 2: ["Canalizar divindade"], 4: [ASI], 5: ["Destruir mortos-vivos"] },
  druida: { 2: ["Forma selvagem", "Círculo druídico"], 4: [ASI] },
  guerreiro: { 2: ["Surto de ação"], 3: ["Arquétipo marcial"], 4: [ASI], 5: ["Ataque extra"] },
  monge: { 2: ["Ki", "Movimento sem armadura"], 3: ["Tradição monástica", "Defletir projéteis"], 4: [ASI, "Queda lenta"], 5: ["Ataque extra", "Golpe atordoante"] },
  paladino: { 2: ["Estilo de luta", "Conjuração", "Destruição divina"], 3: ["Saúde divina", "Juramento sagrado"], 4: [ASI], 5: ["Ataque extra"] },
  patrulheiro: { 2: ["Estilo de luta", "Conjuração"], 3: ["Arquétipo de patrulheiro", "Consciência primitiva"], 4: [ASI], 5: ["Ataque extra"] },
  ladino: { 2: ["Ação ardilosa"], 3: ["Arquétipo de ladino", "Ataque furtivo 2d6"], 4: [ASI], 5: ["Esquiva sobrenatural", "Ataque furtivo 3d6"] },
  feiticeiro: { 2: ["Fonte de magia"], 3: ["Metamagia"], 4: [ASI] },
  bruxo: { 2: ["Invocações místicas"], 3: ["Dádiva do pacto"], 4: [ASI] },
  mago: { 2: ["Tradição arcana"], 4: [ASI] },
};

/** Features gained after level 1, up to `level` (levels above 5 are for the group to add). */
export function featuresUpTo(classKey: string, level: number): { level: number; name: string }[] {
  const table = FEATURES_BY_LEVEL[classKey] ?? {};
  return Object.entries(table)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([lvl, names]) => names.map((name) => ({ level: Number(lvl), name })));
}
