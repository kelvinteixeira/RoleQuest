import type { SystemTemplate } from "@/types/system";
import { attr, COMMON_CONDITIONS, condition, resource, RESOURCE_COLORS, skills } from "./shared";

const SIX_ABILITIES_GROUP = "Atributos";

export const dnd5e: SystemTemplate = {
  id: "dnd5e",
  kind: "builtin",
  name: "Dungeons & Dragons (5ª edição)",
  shortName: "D&D 5e",
  tagline: "Fantasia heroica com d20, classes e níveis.",
  description:
    "Modelo para aventuras de fantasia em grupo: seis atributos com modificador, proficiência por nível, classe de armadura e ações por turno.",
  genres: ["Fantasia", "Aventura"],
  licensing: {
    basis: "open-license",
    note: "Estrutura compatível com o SRD 5.1, disponibilizado sob CC-BY-4.0. Conteúdo de livros não é incluído.",
  },
  theme: { accent: "oklch(0.7 0.17 28)", glyph: "sword", gradient: ["oklch(0.36 0.1 28)", "oklch(0.2 0.04 20)"] },
  dice: {
    primaryDie: "d20",
    mechanic: "d20-plus-modifier",
    defaultFormula: "1d20 + @mod + @prof",
    supportsAdvantage: true,
    criticalRule: "20 natural em ataque é crítico; 1 natural é falha.",
    notes: "Vantagem rola 2d20 e mantém o maior; desvantagem mantém o menor.",
  },
  attributes: [
    attr("str", "Força", "FOR", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
    attr("dex", "Destreza", "DES", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
    attr("con", "Constituição", "CON", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
    attr("int", "Inteligência", "INT", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
    attr("wis", "Sabedoria", "SAB", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
    attr("cha", "Carisma", "CAR", [1, 30, 10], { rollFormula: "1d20 + @mod", group: SIX_ABILITIES_GROUP }),
  ],
  resources: [
    resource("hp", "Pontos de Vida", RESOURCE_COLORS.health, 10, { derivedFrom: "Dado de vida + mod. CON por nível", showOnToken: true }),
    resource("temp_hp", "PV temporários", "oklch(0.75 0.08 200)", 0),
    resource("hit_dice", "Dados de Vida", RESOURCE_COLORS.stamina, 1, { derivedFrom: "1 por nível" }),
    resource("spell_slots", "Espaços de magia", RESOURCE_COLORS.mana, 0, { derivedFrom: "Classe e nível" }),
  ],
  skills: [
    ...skills("str", ["Atletismo"]),
    ...skills("dex", ["Acrobacia", "Furtividade", "Prestidigitação"]),
    ...skills("int", ["Arcanismo", "História", "Investigação", "Natureza", "Religião"]),
    ...skills("wis", ["Intuição", "Lidar com Animais", "Medicina", "Percepção", "Sobrevivência"]),
    ...skills("cha", ["Atuação", "Enganação", "Intimidação", "Persuasão"]),
  ],
  abilitiesLabel: "Magias, talentos e características de classe",
  conditions: [
    ...COMMON_CONDITIONS,
    condition("blinded", "Cego", "Não enxerga; falha em testes que dependem da visão."),
    condition("poisoned", "Envenenado", "Desvantagem em ataques e testes de atributo."),
    condition("invisible", "Invisível", "Não pode ser visto sem meios especiais."),
    condition("exhaustion", "Exaustão", "Penalidades cumulativas por nível de exaustão."),
  ],
  combat: {
    initiativeFormula: "1d20 + @dex.mod",
    defenseLabel: "Classe de Armadura",
    actionEconomy: ["Ação", "Ação bônus", "Reação", "Movimento"],
    distanceUnit: "ft",
    gridCellDistance: 5,
  },
  inventory: {
    model: "weight",
    capacityLabel: "Capacidade de carga (FOR × 15)",
    currencies: ["PC", "PP", "PE", "PO", "PL"],
    equipmentSlots: ["Armadura", "Escudo", "Mão principal", "Mão secundária", "Anel", "Amuleto", "Capa"],
  },
  progression: { model: "levels", label: "Nível", max: 20 },
  customFields: [
    { key: "background", label: "Antecedente", type: "text", section: "Identidade" },
    { key: "alignment", label: "Tendência", type: "text", section: "Identidade" },
    { key: "inspiration", label: "Inspiração", type: "checkbox", section: "Recursos" },
    { key: "death_saves", label: "Testes contra a morte", type: "counter", section: "Combate" },
  ],
  rules: [
    { key: "flanking", label: "Flanquear", description: "Aliados em lados opostos concedem vantagem.", enabledByDefault: false },
    { key: "encumbrance", label: "Carga detalhada", description: "Aplica penalidades por peso carregado.", enabledByDefault: false },
    { key: "milestone", label: "Progressão por marcos", description: "Sobe de nível por eventos da história, sem XP.", enabledByDefault: true },
  ],
  campaignTemplates: [
    { id: "dungeon-crawl", name: "Exploração de masmorra", description: "Salas, armadilhas e um chefe ao final.", tone: ["Aventura", "Tático"] },
    { id: "kingdom-intrigue", name: "Intriga no reino", description: "Facções, alianças e traições na corte.", tone: ["Político", "Drama"] },
  ],
  mapTemplates: [
    { id: "crypt", name: "Cripta subterrânea", biome: "dungeon", columns: 30, rows: 24 },
    { id: "forest-road", name: "Estrada na floresta", biome: "forest", columns: 40, rows: 24 },
    { id: "tavern", name: "Taverna de dois andares", biome: "interior", columns: 24, rows: 18 },
  ],
};

export const pathfinder2e: SystemTemplate = {
  id: "pathfinder2e",
  kind: "builtin",
  name: "Pathfinder (2ª edição)",
  shortName: "Pathfinder 2e",
  tagline: "Fantasia tática com três ações e graus de sucesso.",
  description:
    "Modelo com modificadores de atributo, proficiência em degraus, três ações por turno e quatro graus de sucesso.",
  genres: ["Fantasia", "Tático"],
  licensing: {
    basis: "open-license",
    note: "Estrutura compatível com regras publicadas sob a ORC License. Conteúdo de livros não é incluído.",
  },
  theme: { accent: "oklch(0.72 0.12 230)", glyph: "shield", gradient: ["oklch(0.34 0.08 240)", "oklch(0.19 0.03 250)"] },
  dice: {
    primaryDie: "d20",
    mechanic: "d20-plus-modifier",
    defaultFormula: "1d20 + @mod + @prof",
    supportsAdvantage: false,
    criticalRule: "Superar a CD por 10 ou mais melhora o grau de sucesso; 20 e 1 naturais ajustam um grau.",
    notes: "Quatro graus: falha crítica, falha, sucesso e sucesso crítico.",
  },
  attributes: [
    attr("str", "Força", "FOR", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
    attr("dex", "Destreza", "DES", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
    attr("con", "Constituição", "CON", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
    attr("int", "Inteligência", "INT", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
    attr("wis", "Sabedoria", "SAB", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
    attr("cha", "Carisma", "CAR", [-5, 7, 0], { rollFormula: "1d20 + @value" }),
  ],
  resources: [
    resource("hp", "Pontos de Vida", RESOURCE_COLORS.health, 16, { derivedFrom: "Ancestralidade + (classe + CON) × nível", showOnToken: true }),
    resource("focus", "Pontos de Foco", RESOURCE_COLORS.mana, 1),
    resource("hero", "Pontos de Heroísmo", RESOURCE_COLORS.luck, 1),
  ],
  skills: [
    ...skills("str", ["Atletismo"]),
    ...skills("dex", ["Acrobatismo", "Furtividade", "Ladroagem"]),
    ...skills("int", ["Arcanismo", "Erudição", "Ocultismo", "Sociedade", "Manufatura"]),
    ...skills("wis", ["Medicina", "Natureza", "Religião", "Sobrevivência"]),
    ...skills("cha", ["Diplomacia", "Dissimulação", "Intimidação", "Performance"]),
  ],
  abilitiesLabel: "Talentos, magias e ações",
  conditions: [
    ...COMMON_CONDITIONS,
    condition("off-guard", "Desprevenido", "Penalidade na defesa contra ataques."),
    condition("sickened", "Enjoado", "Penalidade em testes; difícil ingerir algo."),
    condition("dying", "Morrendo", "À beira da morte; o valor indica a gravidade."),
  ],
  combat: {
    initiativeFormula: "1d20 + @perception",
    defenseLabel: "Classe de Armadura",
    actionEconomy: ["Ação 1", "Ação 2", "Ação 3", "Reação"],
    distanceUnit: "ft",
    gridCellDistance: 5,
  },
  inventory: {
    model: "slots",
    capacityLabel: "Volume (5 + mod. FOR)",
    currencies: ["PC", "PP", "PO", "PL"],
    equipmentSlots: ["Armadura", "Mão principal", "Mão secundária", "Itens investidos (até 10)"],
  },
  progression: { model: "levels", label: "Nível", max: 20 },
  customFields: [
    { key: "ancestry", label: "Ancestralidade", type: "text", section: "Identidade" },
    { key: "heritage", label: "Herança", type: "text", section: "Identidade" },
    { key: "proficiency", label: "Proficiências", type: "list", section: "Treinamento" },
  ],
  rules: [
    { key: "free-archetype", label: "Arquétipo livre", description: "Talento de arquétipo adicional em níveis pares.", enabledByDefault: false },
    { key: "proficiency-without-level", label: "Proficiência sem nível", description: "Reduz a escala numérica entre níveis.", enabledByDefault: false },
  ],
  campaignTemplates: [
    { id: "frontier", name: "Fronteira selvagem", description: "Explorar, mapear e reivindicar terras.", tone: ["Exploração", "Sandbox"] },
    { id: "guild", name: "Guilda de aventureiros", description: "Contratos semanais e reputação crescente.", tone: ["Episódico", "Aventura"] },
  ],
  mapTemplates: [
    { id: "ruins", name: "Ruínas na colina", biome: "wilderness", columns: 36, rows: 28 },
    { id: "keep", name: "Fortaleza fronteiriça", biome: "castle", columns: 32, rows: 32 },
  ],
};

export const tormenta20: SystemTemplate = {
  id: "tormenta20",
  kind: "builtin",
  name: "Tormenta20",
  shortName: "T20",
  tagline: "Fantasia épica brasileira com d20 e poderes.",
  description:
    "Modelo com seis atributos usados diretamente como modificadores, perícias treinadas, pontos de vida e de mana.",
  genres: ["Fantasia", "Épico"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Nenhum texto ou cenário oficial é reproduzido.",
  },
  theme: { accent: "oklch(0.66 0.2 22)", glyph: "flame", gradient: ["oklch(0.34 0.13 20)", "oklch(0.18 0.05 15)"] },
  dice: {
    primaryDie: "d20",
    mechanic: "d20-plus-modifier",
    defaultFormula: "1d20 + @value + @skill",
    supportsAdvantage: false,
    criticalRule: "Margem de ameaça e multiplicador definidos pela arma.",
    notes: "Perícias treinadas somam bônus de treino e metade do nível.",
  },
  attributes: [
    attr("for", "Força", "FOR", [-5, 10, 0]),
    attr("des", "Destreza", "DES", [-5, 10, 0]),
    attr("con", "Constituição", "CON", [-5, 10, 0]),
    attr("int", "Inteligência", "INT", [-5, 10, 0]),
    attr("sab", "Sabedoria", "SAB", [-5, 10, 0]),
    attr("car", "Carisma", "CAR", [-5, 10, 0]),
  ],
  resources: [
    resource("pv", "Pontos de Vida", RESOURCE_COLORS.health, 16, { derivedFrom: "Classe + CON, por nível", showOnToken: true }),
    resource("pm", "Pontos de Mana", RESOURCE_COLORS.mana, 4, { derivedFrom: "Classe, por nível", showOnToken: true }),
  ],
  skills: [
    ...skills("des", ["Acrobacia", "Furtividade", "Ladinagem", "Pontaria", "Reflexos"]),
    ...skills("for", ["Atletismo", "Luta"]),
    ...skills("con", ["Fortitude"]),
    ...skills("int", ["Conhecimento", "Investigação", "Misticismo", "Ofício"]),
    ...skills("sab", ["Cura", "Intuição", "Percepção", "Sobrevivência", "Vontade"]),
    ...skills("car", ["Diplomacia", "Enganação", "Intimidação", "Jogatina"]),
  ],
  abilitiesLabel: "Poderes e magias",
  conditions: [
    ...COMMON_CONDITIONS,
    condition("flat-footed", "Desprevenido", "Penalidade na Defesa e em Reflexos."),
    condition("fatigued", "Fatigado", "Penalidades físicas até descansar."),
  ],
  combat: {
    initiativeFormula: "1d20 + @des + @iniciativa",
    defenseLabel: "Defesa",
    actionEconomy: ["Padrão", "Movimento", "Livre", "Reação"],
    distanceUnit: "m",
    gridCellDistance: 1.5,
  },
  inventory: {
    model: "slots",
    capacityLabel: "Espaços (10 + 2 × FOR)",
    currencies: ["TC", "TP", "TO"],
    equipmentSlots: ["Armadura", "Escudo", "Arma principal", "Arma secundária", "Vestuário"],
  },
  progression: { model: "levels", label: "Nível", max: 20 },
  customFields: [
    { key: "race", label: "Raça", type: "text", section: "Identidade" },
    { key: "origin", label: "Origem", type: "text", section: "Identidade" },
    { key: "deity", label: "Divindade", type: "text", section: "Identidade" },
  ],
  rules: [
    { key: "heroic-points", label: "Pontos heroicos", description: "Recurso extra para rerrolagens dramáticas (regra da casa).", enabledByDefault: false },
  ],
  campaignTemplates: [
    { id: "reino-em-guerra", name: "Reino em guerra", description: "Heróis no meio de um conflito entre nações.", tone: ["Épico", "Guerra"] },
    { id: "cacada", name: "Caçada a monstros", description: "Contratos para eliminar ameaças regionais.", tone: ["Ação", "Episódico"] },
  ],
  mapTemplates: [
    { id: "vila", name: "Vila de fronteira", biome: "village", columns: 36, rows: 28 },
    { id: "covil", name: "Covil na montanha", biome: "cave", columns: 30, rows: 24 },
  ],
};

export const tresDeTVictory: SystemTemplate = {
  id: "3dt-victory",
  kind: "builtin",
  name: "3D&T Victory",
  shortName: "3D&T",
  tagline: "Ação rápida no estilo anime, mangá e games.",
  description: "Modelo enxuto com três características, perícias amplas, vantagens e desvantagens compradas com pontos.",
  genres: ["Anime", "Ação", "Leve"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Ajuste fórmulas conforme a regra oficial.",
  },
  theme: { accent: "oklch(0.78 0.15 330)", glyph: "star", gradient: ["oklch(0.36 0.12 330)", "oklch(0.2 0.05 300)"] },
  dice: {
    primaryDie: "d6",
    mechanic: "d6-plus-attribute",
    defaultFormula: "1d6 + @value",
    supportsAdvantage: false,
    criticalRule: "Resultado 6 no dado é crítico (configurável).",
    notes: "Fórmula editável pelo mestre — o modelo não impõe a regra do livro.",
  },
  attributes: [
    attr("poder", "Poder", "P", [0, 5, 1]),
    attr("habilidade", "Habilidade", "H", [0, 5, 1]),
    attr("resistencia", "Resistência", "R", [0, 5, 1]),
  ],
  resources: [
    resource("pv", "Pontos de Vida", RESOURCE_COLORS.health, 5, { derivedFrom: "Resistência × 5", showOnToken: true }),
    resource("pm", "Pontos de Mana", RESOURCE_COLORS.mana, 5, { derivedFrom: "Resistência × 5" }),
    resource("pa", "Pontos de Ação", RESOURCE_COLORS.stamina, 1, { derivedFrom: "Poder" }),
  ],
  skills: skills(undefined, ["Animais", "Arte", "Esporte", "Influência", "Luta", "Manha", "Máquinas", "Medicina", "Mística", "Percepção", "Saber", "Sobrevivência"]),
  abilitiesLabel: "Vantagens, desvantagens e técnicas",
  conditions: COMMON_CONDITIONS,
  combat: {
    initiativeFormula: "1d6 + @habilidade",
    defenseLabel: "Defesa",
    actionEconomy: ["Ação", "Movimento"],
    distanceUnit: "m",
    gridCellDistance: 1,
  },
  inventory: { model: "list", capacityLabel: "Itens", currencies: ["Moedas"], equipmentSlots: [] },
  progression: { model: "character-points", label: "Pontos de personagem" },
  customFields: [
    { key: "archetype", label: "Arquétipo", type: "text", section: "Identidade" },
    { key: "advantages", label: "Vantagens", type: "list", section: "Habilidades" },
    { key: "disadvantages", label: "Desvantagens", type: "list", section: "Habilidades" },
  ],
  rules: [{ key: "exploding-six", label: "Seis explosivo", description: "Rolar 6 permite rolar outro dado e somar.", enabledByDefault: false }],
  campaignTemplates: [
    { id: "torneio", name: "Grande torneio", description: "Lutas em chaves com rivais memoráveis.", tone: ["Ação", "Leve"] },
    { id: "escola", name: "Academia de heróis", description: "Aulas, rivalidades e ameaças ao campus.", tone: ["Slice of life", "Aventura"] },
  ],
  mapTemplates: [{ id: "arena", name: "Arena de torneio", biome: "city", columns: 24, rows: 24 }],
};
