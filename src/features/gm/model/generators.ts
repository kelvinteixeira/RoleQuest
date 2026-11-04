/**
 * Quick generators for the GM: names, NPCs, places, treasure and plot hooks,
 * tuned to the campaign's setting. Deterministic for a given seed (so they
 * can be tested and a result can be re-created); original text only.
 */
import type { NpcStatBlock } from "@/features/combat/model/types";
import type { NpcAttitude, NpcInput } from "@/types/gm";

export type Setting = "fantasy" | "horror" | "modern";

export const SETTING_LABEL: Record<Setting, string> = { fantasy: "Fantasia", horror: "Horror", modern: "Moderno / Cyberpunk" };

/** The generator setting from a system's genres. */
export function settingFor(genres: string[]): Setting {
  const g = genres.join(" ").toLowerCase();
  if (/cyberpunk|distopia|moderno/.test(g)) return "modern";
  if (/horror|investiga/.test(g)) return "horror";
  return "fantasy";
}

/** Small seeded PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickWith = (rnd: () => number) => <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];

const NAMES: Record<Setting, { first: string[]; last: string[] }> = {
  fantasy: {
    first: ["Aldric", "Brisa", "Corvin", "Darla", "Elowen", "Fenric", "Galena", "Hadrik", "Isara", "Jorund", "Kaela", "Lioren", "Marek", "Nimra", "Orlan", "Petra", "Quill", "Rhosyn", "Soren", "Tamsa", "Ulric", "Vesna", "Wren", "Yara"],
    last: ["Pedraviva", "Cinzafolha", "Martelo-Rubro", "Ventobravo", "Lâminafria", "Corvalto", "Brasaluz", "Fundoforte", "Rioclaro", "Espinhal", "Torreval", "Sombralume"],
  },
  horror: {
    first: ["Abigail", "Benedito", "Clara", "Damião", "Elvira", "Félix", "Graça", "Henrique", "Inês", "Jonas", "Lúcia", "Mateus", "Noêmia", "Otávio", "Rute", "Silas", "Teresa", "Valter"],
    last: ["Albuquerque", "Bragança", "Carvalhal", "Dornelles", "Escobar", "Fontoura", "Guedes", "Hollanda", "Lacerda", "Monteiro", "Nogueira", "Prestes", "Quintela", "Valadares"],
  },
  modern: {
    first: ["Ash", "Bia", "Cruz", "Dani", "Echo", "Faísca", "Gus", "Hex", "Iris", "Jax", "Kai", "Lua", "Maré", "Nix", "Onze", "Pixel", "Raven", "Sol", "Tchê", "Vega", "Zero"],
    last: ["Moreira", "Okafor", "Tanaka", "Silva", "Kowalski", "Reyes", "Nakamura", "Duarte", "Volkov", "Andrade", "Mbeki", "Ferraz"],
  },
};

const CONCEPTS: Record<Setting, string[]> = {
  fantasy: ["ferreiro desconfiado", "sacerdotisa errante", "mercador de relíquias", "guarda corrupto", "bardo endividado", "caçadora de recompensas", "erudito da torre", "contrabandista do porto", "cavaleiro caído", "curandeira da vila"],
  horror: ["médico do sanatório", "jornalista insone", "padre de cidade pequena", "colecionador de antiguidades", "delegado cansado", "herdeira de uma casa antiga", "bibliotecária reservada", "pescador que viu algo", "professora de línguas mortas", "fotógrafo de funerais"],
  modern: ["fixer do mercado negro", "netrunner freelancer", "segurança corporativa", "médica de beco", "repórter pirata", "piloto de entrega", "executiva de megacorporação", "mecânico de implantes", "influencer em decadência", "policial em licença"],
};

const TRAITS = ["fala baixo e mede cada palavra", "ri alto de qualquer coisa", "nunca encara ninguém nos olhos", "coleciona favores, não moedas", "tem uma cicatriz que não explica", "repete o nome de quem acabou de conhecer", "está sempre comendo algo", "anota tudo num caderninho", "é gentil até ser contrariado", "desconfia de quem é educado demais"];

const WANTS = ["quitar uma dívida antiga", "proteger um parente", "sair da cidade sem ser visto", "provar que não é culpado", "achar quem roubou seu sustento", "subir de posição a qualquer custo", "esquecer o que viu", "vingar um amigo"];

const SECRETS: Record<Setting, string[]> = {
  fantasy: ["serve a uma das casas nobres em segredo", "é procurado em outro reino com outro nome", "guarda a chave de uma cripta selada", "deve a vida a um dragão", "vende informações aos dois lados"],
  horror: ["participou do ritual de 1923", "escreve cartas para alguém que morreu", "sabe onde estão os desaparecidos", "ouve vozes desde a última lua cheia", "esconde algo no porão"],
  modern: ["trabalha infiltrado para uma corporação", "tem um implante ilegal de memória", "deve muito a uma gangue", "já foi outra pessoa (identidade apagada)", "vazou dados que valem uma fortuna"],
};

/** Whole names (so articles and adjectives always agree). */
const PLACES: Record<Setting, { names: string[]; kinds: string[] }> = {
  fantasy: {
    names: ["O Javali Bêbado", "A Caneca Dourada", "O Corvo Rouco", "A Âncora Partida", "O Grifo Cansado", "A Lanterna Azul", "O Dragão Adormecido", "A Raposa Manca", "O Barril Sem Fundo"],
    kinds: ["taverna", "estalagem", "posto de troca"],
  },
  horror: {
    names: ["Hotel Central", "Bar das Almas", "Pensão Santa Rita", "Café do Porto", "Armazém Esperança", "Hotel Noturno", "Bar do Farol"],
    kinds: ["hotel decadente", "bar de beira de estrada", "pensão antiga"],
  },
  modern: {
    names: ["Neon Afterlife", "Bar Estática", "Clube Zero Hora", "Cantina Cromo", "Garagem Fiação", "Glitch Lounge", "Bar Curto-Circuito"],
    kinds: ["bar de fixers", "clube subterrâneo", "food truck blindado"],
  },
};

const TREASURE: Record<Setting, string[]> = {
  fantasy: ["bolsa com {n} moedas de ouro", "adaga de prata com runas apagadas", "mapa parcial de uma mina abandonada", "poção de cura em frasco rachado", "anel com brasão de família desconhecida", "pergaminho selado com cera negra", "{n} gemas pequenas e opacas"],
  horror: ["diário com páginas arrancadas", "fotografia de pessoas que não deveriam estar juntas", "chave antiga com etiqueta de hotel", "revólver com {n} balas de prata", "recorte de jornal de 1923", "frasco de láudano", "carta nunca enviada"],
  modern: ["chip de dados criptografado", "{n}0 créditos em um cartão anônimo", "implante ocular usado", "pistola inteligente sem registro", "chave de acesso de um prédio corporativo", "drone dobrável com bateria fraca", "lista de nomes e endereços"],
};

const HOOKS: Record<Setting, string[]> = {
  fantasy: ["Uma caravana chegou sem nenhum condutor — e os cavalos continuam assustados.", "O sino do templo tocou sozinho três noites seguidas.", "Um nobre oferece ouro para recuperar uma carta, e não diz o que ela contém.", "A ponte do rio foi cortada de propósito, e há pegadas que não são humanas.", "Uma criança vende mapas que mostram lugares que ainda não existem."],
  horror: ["Todos os relógios da cidade pararam no mesmo minuto.", "Uma casa vazia tem luz acesa toda noite às 3h.", "O antigo dono do hotel voltou — mas foi enterrado há dez anos.", "Uma fita cassete chega pelo correio com a voz de um dos personagens.", "Os cães da vila se recusam a cruzar a velha estrada."],
  modern: ["Um cliente paga o triplo por uma entrega e pede para não abrir a caixa.", "Um apagão de 7 minutos apagou todos os registros de um bairro.", "Alguém está usando o rosto de um dos personagens em anúncios.", "Uma IA de trânsito começou a mandar carros para o mesmo endereço.", "Um ex-colega aparece pedindo abrigo e com um implante piscando em vermelho."],
};

export type ThreatLevel = "minion" | "common" | "elite" | "boss";

export const THREAT_LABEL: Record<ThreatLevel, string> = { minion: "Lacaio", common: "Comum", elite: "Elite", boss: "Chefe" };

const THREAT_STATS: Record<ThreatLevel, NpcStatBlock> = {
  minion: { hp: 7, defense: 11, attackBonus: 3, damage: "1d6", speed: 6, initiativeBonus: 1 },
  common: { hp: 13, defense: 13, attackBonus: 4, damage: "1d8+2", speed: 6, initiativeBonus: 2 },
  elite: { hp: 32, defense: 15, attackBonus: 6, damage: "2d6+3", speed: 6, initiativeBonus: 3 },
  boss: { hp: 70, defense: 16, attackBonus: 8, damage: "2d8+4", speed: 6, initiativeBonus: 3 },
};

const COLORS = ["oklch(0.62 0.13 30)", "oklch(0.6 0.12 90)", "oklch(0.6 0.13 160)", "oklch(0.6 0.13 230)", "oklch(0.6 0.14 290)", "oklch(0.62 0.13 340)"];

export function generateName(setting: Setting, seed: number): string {
  const pick = pickWith(seededRandom(seed));
  return `${pick(NAMES[setting].first)} ${pick(NAMES[setting].last)}`;
}

/** A ready-to-save NPC: name, concept, a trait, a want and a secret, stats for its threat level. */
export function generateNpc(campaignId: string, setting: Setting, seed: number, options: { threat?: ThreatLevel; attitude?: NpcAttitude } = {}): NpcInput {
  const rnd = seededRandom(seed);
  const pick = pickWith(rnd);
  const threatLevel = options.threat ?? "common";
  const concept = pick(CONCEPTS[setting]);
  const trait = pick(TRAITS);
  const want = pick(WANTS);
  const secret = pick(SECRETS[setting]);
  return {
    campaignId,
    name: generateName(setting, seed + 101),
    concept: concept.charAt(0).toUpperCase() + concept.slice(1),
    attitude: options.attitude ?? "neutral",
    portraitColor: pick(COLORS),
    location: "",
    description: `${concept.charAt(0).toUpperCase() + concept.slice(1)} que ${trait}.`,
    secretNotes: `Quer ${want}. Segredo: ${secret}.`,
    facts: [],
    stats: { ...THREAT_STATS[threatLevel], attackName: "Ataque" },
    known: false,
  };
}

export function generatePlace(setting: Setting, seed: number): string {
  const pick = pickWith(seededRandom(seed));
  const { names, kinds } = PLACES[setting];
  return `${pick(names)} (${pick(kinds)}): o dono ${pick(TRAITS)}.`;
}

export function generateTreasure(setting: Setting, seed: number, count = 3): string[] {
  const rnd = seededRandom(seed);
  const pick = pickWith(rnd);
  const pool = [...TREASURE[setting]];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const item = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out.push(item.replace("{n}", String(2 + Math.floor(rnd() * 18))));
  }
  return out.length ? out : [pick(TREASURE[setting])];
}

export function generateHook(setting: Setting, seed: number): string {
  return pickWith(seededRandom(seed))(HOOKS[setting]);
}
