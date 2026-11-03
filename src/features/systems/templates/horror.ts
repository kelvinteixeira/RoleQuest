import type { AttributeDefinition, SystemTemplate } from "@/types/system";
import { attr, COMMON_CONDITIONS, condition, resource, RESOURCE_COLORS, skills } from "./shared";

export const callOfCthulhu: SystemTemplate = {
  id: "call-of-cthulhu",
  kind: "builtin",
  name: "Call of Cthulhu",
  shortName: "CoC",
  tagline: "Investigação e horror cósmico com d100.",
  description:
    "Modelo percentual: características de 0 a 99, testes rolando abaixo do valor, sanidade que se desgasta e níveis de sucesso.",
  genres: ["Horror", "Investigação"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Nenhum texto, criatura ou cenário oficial é reproduzido.",
  },
  theme: { accent: "oklch(0.72 0.1 165)", glyph: "eye", gradient: ["oklch(0.3 0.06 170)", "oklch(0.17 0.02 190)"] },
  dice: {
    primaryDie: "d100",
    mechanic: "d100-roll-under",
    defaultFormula: "1d100 <= @value",
    supportsAdvantage: true,
    criticalRule: "Metade do valor é sucesso difícil; um quinto é extremo; 01 é crítico.",
    notes: "Dados de bônus/penalidade substituem a dezena — equivalem a vantagem/desvantagem.",
  },
  attributes: [
    attr("str", "Força", "FOR", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("con", "Constituição", "CON", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("siz", "Tamanho", "TAM", [0, 99, 50]),
    attr("dex", "Destreza", "DES", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("app", "Aparência", "APA", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("int", "Inteligência", "INT", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("pow", "Poder", "POD", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
    attr("edu", "Educação", "EDU", [0, 99, 50], { rollFormula: "1d100 <= @value" }),
  ],
  resources: [
    resource("hp", "Pontos de Vida", RESOURCE_COLORS.health, 10, { derivedFrom: "(CON + TAM) / 10", showOnToken: true }),
    resource("san", "Sanidade", RESOURCE_COLORS.sanity, 50, { derivedFrom: "Igual a POD", showOnToken: true }),
    resource("mp", "Pontos de Magia", RESOURCE_COLORS.mana, 10, { derivedFrom: "POD / 5" }),
    resource("luck", "Sorte", RESOURCE_COLORS.luck, 50),
  ],
  skills: skills(undefined, [
    "Biblioteca",
    "Charme",
    "Encontrar",
    "Escutar",
    "Esquivar",
    "Furtividade",
    "História",
    "Intimidação",
    "Lutar (briga)",
    "Medicina",
    "Ocultismo",
    "Persuasão",
    "Primeiros socorros",
    "Psicologia",
    "Rastrear",
  ]),
  abilitiesLabel: "Ocupação, contatos e tomos",
  conditions: [
    ...COMMON_CONDITIONS,
    condition("temporary-insanity", "Insanidade temporária", "Crise passageira após um choque intenso."),
    condition("indefinite-insanity", "Insanidade indefinida", "Abalo prolongado que exige tratamento."),
    condition("major-wound", "Ferimento grave", "Lesão séria; risco de perder a consciência."),
  ],
  combat: {
    initiativeFormula: "@dex",
    defenseLabel: "Esquivar / Contra-atacar",
    actionEconomy: ["Ação", "Movimento"],
    distanceUnit: "m",
    gridCellDistance: 1.5,
  },
  inventory: { model: "list", capacityLabel: "Pertences", currencies: ["Dinheiro", "Patrimônio"], equipmentSlots: [] },
  progression: { model: "experience-points", label: "Melhorias de perícia" },
  customFields: [
    { key: "occupation", label: "Ocupação", type: "text", section: "Identidade" },
    { key: "era", label: "Época", type: "select", options: ["Anos 1920", "Atualidade", "Outra"], section: "Identidade" },
    { key: "phobias", label: "Fobias e manias", type: "list", section: "Mente" },
    { key: "encounters", label: "Encontros com o desconhecido", type: "textarea", section: "Mente" },
  ],
  rules: [
    { key: "pulp", label: "Modo pulp", description: "Heróis mais resistentes e ação mais intensa.", enabledByDefault: false },
    { key: "luck-spend", label: "Gastar sorte", description: "Permite usar Sorte para ajustar resultados.", enabledByDefault: true },
  ],
  campaignTemplates: [
    { id: "small-town", name: "Cidade costeira", description: "Desaparecimentos, segredos de família e algo no mar.", tone: ["Horror", "Mistério"] },
    { id: "expedition", name: "Expedição", description: "Uma viagem a um lugar que não deveria existir.", tone: ["Horror", "Exploração"] },
  ],
  mapTemplates: [
    { id: "manor", name: "Mansão abandonada", biome: "interior", columns: 30, rows: 22 },
    { id: "harbor", name: "Porto à noite", biome: "city", columns: 40, rows: 26 },
  ],
};

/** The nine-attribute grid shared by the two storyteller-style templates. */
function storytellerAttributes(): AttributeDefinition[] {
  const pool = { rollFormula: "@pool d10 >= 6" };
  return [
    attr("strength", "Força", "FOR", [1, 5, 1], { ...pool, group: "Físicos" }),
    attr("dexterity", "Destreza", "DES", [1, 5, 1], { ...pool, group: "Físicos" }),
    attr("stamina", "Vigor", "VIG", [1, 5, 1], { ...pool, group: "Físicos" }),
    attr("charisma", "Carisma", "CAR", [1, 5, 1], { ...pool, group: "Sociais" }),
    attr("manipulation", "Manipulação", "MAN", [1, 5, 1], { ...pool, group: "Sociais" }),
    attr("composure", "Autocontrole", "AUT", [1, 5, 1], { ...pool, group: "Sociais" }),
    attr("intelligence", "Inteligência", "INT", [1, 5, 1], { ...pool, group: "Mentais" }),
    attr("wits", "Raciocínio", "RAC", [1, 5, 1], { ...pool, group: "Mentais" }),
    attr("resolve", "Determinação", "DET", [1, 5, 1], { ...pool, group: "Mentais" }),
  ];
}

const STORYTELLER_SKILLS = [
  ...skills(undefined, ["Armas brancas", "Armas de fogo", "Atletismo", "Briga", "Condução", "Furtividade", "Ladroagem", "Ofícios", "Sobrevivência"]),
  ...skills(undefined, ["Empatia com animais", "Etiqueta", "Intimidação", "Intuição", "Liderança", "Manha", "Performance", "Persuasão", "Subterfúgio"]),
  ...skills(undefined, ["Ciência", "Erudição", "Finanças", "Investigação", "Medicina", "Ocultismo", "Percepção", "Política", "Tecnologia"]),
];

export const vampireMasquerade: SystemTemplate = {
  id: "vampire-masquerade",
  kind: "builtin",
  name: "Vampiro: A Máscara",
  shortName: "Vampiro",
  tagline: "Horror pessoal e política noturna com parada de d10.",
  description:
    "Modelo narrativo com nove atributos em três grupos, parada de dados d10, fome crescente e a luta para manter a humanidade.",
  genres: ["Horror pessoal", "Intriga"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Clãs, disciplinas e cenário oficiais não são reproduzidos.",
  },
  theme: { accent: "oklch(0.6 0.2 15)", glyph: "droplet", gradient: ["oklch(0.3 0.12 12)", "oklch(0.15 0.04 10)"] },
  dice: {
    primaryDie: "d10",
    mechanic: "d10-dice-pool",
    defaultFormula: "(@attr + @skill)d10 >= 6",
    supportsAdvantage: false,
    criticalRule: "Pares de 10 contam como sucesso crítico.",
    notes: "Dados de fome substituem dados normais e podem gerar complicações.",
  },
  attributes: storytellerAttributes(),
  resources: [
    resource("health", "Vitalidade", RESOURCE_COLORS.health, 4, { derivedFrom: "Vigor + 3", showOnToken: true }),
    resource("willpower", "Força de Vontade", RESOURCE_COLORS.will, 2, { derivedFrom: "Autocontrole + Determinação" }),
    resource("hunger", "Fome", RESOURCE_COLORS.hunger, 5, { showOnToken: true }),
    resource("humanity", "Humanidade", RESOURCE_COLORS.humanity, 10),
  ],
  skills: STORYTELLER_SKILLS,
  abilitiesLabel: "Disciplinas e poderes",
  conditions: [
    condition("impaired", "Debilitado", "Vitalidade ou vontade esgotadas; penalidade nas paradas."),
    condition("frenzy", "Frenesi", "Perde o controle para a besta interior."),
    condition("torpor", "Torpor", "Sono profundo semelhante à morte."),
    condition("compulsion", "Compulsão", "Impulso que precisa ser atendido."),
  ],
  combat: {
    initiativeFormula: "Ordem narrativa (conflito)",
    defenseLabel: "Defesa",
    actionEconomy: ["Ação", "Movimento"],
    distanceUnit: "m",
    gridCellDistance: 1.5,
  },
  inventory: { model: "list", capacityLabel: "Posses", currencies: ["Recursos"], equipmentSlots: [] },
  progression: { model: "experience-points", label: "Experiência" },
  customFields: [
    { key: "lineage", label: "Linhagem", type: "text", section: "Identidade" },
    { key: "sire", label: "Senhor", type: "text", section: "Identidade" },
    { key: "generation", label: "Geração", type: "number", section: "Identidade" },
    { key: "convictions", label: "Convicções e pilares", type: "list", section: "Humanidade" },
    { key: "predator", label: "Estilo de caça", type: "text", section: "Fome" },
  ],
  rules: [
    { key: "hunger-dice", label: "Dados de fome", description: "Substitui dados normais conforme a fome atual.", enabledByDefault: true },
    { key: "masquerade-tracker", label: "Ameaça à Máscara", description: "Contador de exposição da cidade.", enabledByDefault: false },
  ],
  campaignTemplates: [
    { id: "city-chronicle", name: "Crônica urbana", description: "Uma cidade, suas facções e uma noite que muda tudo.", tone: ["Intriga", "Horror pessoal"] },
    { id: "coterie", name: "Coterie recém-transformada", description: "Os primeiros anos na não-vida.", tone: ["Drama", "Sobrevivência"] },
  ],
  mapTemplates: [
    { id: "nightclub", name: "Casa noturna", biome: "interior", columns: 28, rows: 20 },
    { id: "rooftops", name: "Telhados do centro", biome: "city", columns: 36, rows: 24 },
  ],
};

export const werewolfApocalypse: SystemTemplate = {
  id: "werewolf-apocalypse",
  kind: "builtin",
  name: "Lobisomem: O Apocalipse",
  shortName: "Lobisomem",
  tagline: "Fúria, matilha e a luta por um mundo ferido.",
  description:
    "Modelo narrativo com parada de d10, fúria que alimenta poderes e cobra seu preço, renome e formas de mudança.",
  genres: ["Horror", "Ação", "Ecológico"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Tribos, dons e cenário oficiais não são reproduzidos.",
  },
  theme: { accent: "oklch(0.74 0.13 75)", glyph: "moon", gradient: ["oklch(0.32 0.07 80)", "oklch(0.17 0.03 120)"] },
  dice: {
    primaryDie: "d10",
    mechanic: "d10-dice-pool",
    defaultFormula: "(@attr + @skill)d10 >= 6",
    supportsAdvantage: false,
    criticalRule: "Pares de 10 contam como sucesso crítico.",
    notes: "Dados de fúria substituem dados normais e podem causar perda de controle.",
  },
  attributes: storytellerAttributes(),
  resources: [
    resource("health", "Vitalidade", RESOURCE_COLORS.health, 4, { derivedFrom: "Vigor + 3", showOnToken: true }),
    resource("willpower", "Força de Vontade", RESOURCE_COLORS.will, 2, { derivedFrom: "Autocontrole + Determinação" }),
    resource("rage", "Fúria", RESOURCE_COLORS.rage, 5, { showOnToken: true }),
    resource("harmony", "Equilíbrio", RESOURCE_COLORS.humanity, 5),
  ],
  skills: STORYTELLER_SKILLS,
  abilitiesLabel: "Dons e rituais",
  conditions: [
    condition("impaired", "Debilitado", "Vitalidade ou vontade esgotadas; penalidade nas paradas."),
    condition("rage-frenzy", "Descontrole", "A fúria assume o comando."),
    condition("shifted", "Forma alterada", "Em forma de combate ou animal."),
  ],
  combat: {
    initiativeFormula: "Ordem narrativa (conflito)",
    defenseLabel: "Defesa",
    actionEconomy: ["Ação", "Movimento", "Mudança de forma"],
    distanceUnit: "m",
    gridCellDistance: 1.5,
  },
  inventory: { model: "list", capacityLabel: "Posses e fetiches", currencies: ["Recursos"], equipmentSlots: [] },
  progression: { model: "experience-points", label: "Experiência" },
  customFields: [
    { key: "pack", label: "Matilha", type: "text", section: "Identidade" },
    { key: "renown", label: "Renome", type: "counter", section: "Identidade" },
    { key: "touchstones", label: "Pilares", type: "list", section: "Equilíbrio" },
    { key: "forms", label: "Formas disponíveis", type: "list", section: "Forma" },
  ],
  rules: [{ key: "rage-dice", label: "Dados de fúria", description: "Substitui dados conforme a fúria atual.", enabledByDefault: true }],
  campaignTemplates: [
    { id: "caern", name: "Proteger o território", description: "Uma floresta ameaçada e inimigos de todos os lados.", tone: ["Ação", "Ecológico"] },
  ],
  mapTemplates: [
    { id: "forest-clearing", name: "Clareira sagrada", biome: "forest", columns: 32, rows: 32 },
    { id: "factory", name: "Fábrica poluente", biome: "futuristic", columns: 36, rows: 24 },
  ],
};

export const ordemParanormal: SystemTemplate = {
  id: "ordem-paranormal",
  kind: "builtin",
  name: "Ordem Paranormal RPG",
  shortName: "Ordem",
  tagline: "Agentes investigando o paranormal com Xd20.",
  description:
    "Modelo com cinco atributos que definem quantos d20 rolar (mantendo o maior), esforço, sanidade e exposição crescente ao paranormal.",
  genres: ["Horror", "Investigação", "Ação"],
  licensing: {
    basis: "compatibility",
    note: "Estrutura de ficha para uso com material adquirido legalmente. Rituais, criaturas e cenário oficiais não são reproduzidos.",
  },
  theme: { accent: "oklch(0.76 0.14 300)", glyph: "ghost", gradient: ["oklch(0.3 0.1 300)", "oklch(0.15 0.03 290)"] },
  dice: {
    primaryDie: "d20",
    mechanic: "d20-pool-keep-highest",
    defaultFormula: "@value d20kh1 + @skill",
    supportsAdvantage: false,
    criticalRule: "Margem de ameaça definida pela arma.",
    notes: "Atributo 0 rola 2d20 e mantém o menor.",
  },
  attributes: [
    attr("agi", "Agilidade", "AGI", [0, 5, 1], { rollFormula: "@value d20kh1" }),
    attr("for", "Força", "FOR", [0, 5, 1], { rollFormula: "@value d20kh1" }),
    attr("int", "Intelecto", "INT", [0, 5, 1], { rollFormula: "@value d20kh1" }),
    attr("pre", "Presença", "PRE", [0, 5, 1], { rollFormula: "@value d20kh1" }),
    attr("vig", "Vigor", "VIG", [0, 5, 1], { rollFormula: "@value d20kh1" }),
  ],
  resources: [
    resource("pv", "Pontos de Vida", RESOURCE_COLORS.health, 20, { derivedFrom: "Classe + VIG, por NEX", showOnToken: true }),
    resource("pe", "Pontos de Esforço", RESOURCE_COLORS.stamina, 3, { derivedFrom: "Classe + PRE, por NEX", showOnToken: true }),
    resource("san", "Sanidade", RESOURCE_COLORS.sanity, 12, { derivedFrom: "Classe, por NEX", showOnToken: true }),
  ],
  skills: skills(undefined, [
    "Acrobacia",
    "Atletismo",
    "Ciências",
    "Crime",
    "Diplomacia",
    "Enganação",
    "Fortitude",
    "Furtividade",
    "Intuição",
    "Investigação",
    "Luta",
    "Medicina",
    "Ocultismo",
    "Percepção",
    "Pontaria",
    "Reflexos",
    "Tecnologia",
    "Vontade",
  ]),
  abilitiesLabel: "Poderes e rituais",
  conditions: [
    ...COMMON_CONDITIONS,
    condition("dying", "Morrendo", "Com 0 PV; precisa de ajuda rapidamente."),
    condition("insane", "Enlouquecendo", "Com 0 de Sanidade; a mente cede."),
  ],
  combat: {
    initiativeFormula: "@agi d20kh1 + @iniciativa",
    defenseLabel: "Defesa",
    actionEconomy: ["Padrão", "Movimento", "Reação"],
    distanceUnit: "m",
    gridCellDistance: 1.5,
  },
  inventory: {
    model: "slots",
    capacityLabel: "Espaços (5 × FOR)",
    currencies: ["Prestígio"],
    equipmentSlots: ["Arma", "Proteção", "Acessórios"],
  },
  progression: { model: "levels", label: "NEX", max: 99 },
  customFields: [
    { key: "origin", label: "Origem", type: "text", section: "Identidade" },
    { key: "class", label: "Classe", type: "select", options: ["Combatente", "Especialista", "Ocultista"], section: "Identidade" },
    { key: "track", label: "Trilha", type: "text", section: "Identidade" },
    { key: "rank", label: "Patente", type: "text", section: "Agência" },
  ],
  rules: [
    { key: "survival-mode", label: "Modo sobrevivência", description: "Recursos escassos e descanso limitado.", enabledByDefault: false },
  ],
  campaignTemplates: [
    { id: "case-of-the-week", name: "Caso da semana", description: "Missões curtas investigando ocorrências.", tone: ["Investigação", "Episódico"] },
    { id: "outbreak", name: "Surto na cidade", description: "Algo atravessou e está se espalhando.", tone: ["Horror", "Ação"] },
  ],
  mapTemplates: [
    { id: "abandoned-school", name: "Escola abandonada", biome: "interior", columns: 34, rows: 22 },
    { id: "ritual-site", name: "Local de ritual", biome: "supernatural", columns: 24, rows: 24 },
  ],
};
