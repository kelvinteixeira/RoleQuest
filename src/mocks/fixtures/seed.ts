/**
 * Demo dataset. Imported ONLY by the mock repositories.
 * Dates are generated relative to "now" so upcoming sessions stay in the future
 * when the database is first seeded (or reset from Settings).
 */
import type { Campaign, CampaignInvite, CampaignMember, GameSession } from "@/types/campaign";
import type { Character } from "@/types/character";
import type { LibraryAsset } from "@/types/library";
import type { UserProfile } from "@/types/user";
import type { SystemTemplate } from "@/types/system";
import { withDemoSheet } from "./demo-sheets";

export interface MockUserRecord {
  profile: UserProfile;
  /** sha256(`${email}:${password}`); null = account cannot sign in (seeded NPC users). */
  passwordHash: string | null;
}

export interface MockSeed {
  users: MockUserRecord[];
  campaigns: Campaign[];
  sessions: GameSession[];
  invites: CampaignInvite[];
  characters: Character[];
  library: LibraryAsset[];
  customSystems: { ownerId: string; system: SystemTemplate }[];
}

export const DEMO_USER_ID = "user_rafael";

export function createSeed(now: Date = new Date()): MockSeed {
  const day = 24 * 60 * 60 * 1000;
  const at = (days: number, hour = 20, minute = 0) => {
    const d = new Date(now.getTime() + days * day);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const created = at(-200);

  const user = (
    id: string,
    displayName: string,
    username: string,
    avatarColor: string,
    extra: Partial<UserProfile> = {},
  ): MockUserRecord => ({
    passwordHash: null,
    profile: {
      id,
      email: `${username}@exemplo.dev`,
      displayName,
      username,
      avatarUrl: null,
      avatarColor,
      bio: "",
      playStyle: "player",
      favoriteSystemIds: [],
      timezone: "America/Sao_Paulo",
      onboardingCompleted: true,
      createdAt: created,
      updatedAt: created,
      ...extra,
    },
  });

  const users: MockUserRecord[] = [
    {
      passwordHash: "a60099728f01b43699b058e9b63726347257b19bd65bec5fd15a0af230c7e138",
      profile: {
        ...user(DEMO_USER_ID, "Rafael Antunes", "rafa.mestre", "oklch(0.62 0.14 70)").profile,
        email: "mestre@rolequest.dev",
        bio: "Mestre de fantasia sombria às sextas, jogador de horror quando sobra tempo.",
        playStyle: "both",
        favoriteSystemIds: ["dnd5e", "call-of-cthulhu", "ordem-paranormal"],
      },
    },
    user("user_lia", "Lia Moraes", "lia.moraes", "oklch(0.6 0.17 350)", { playStyle: "game_master" }),
    user("user_bruno", "Bruno Kaz", "brunokaz", "oklch(0.58 0.15 255)", { playStyle: "both" }),
    user("user_camila", "Camila Duarte", "camiladuarte", "oklch(0.6 0.13 150)"),
    user("user_davi", "Davi Okafor", "davi.ok", "oklch(0.62 0.16 30)"),
    user("user_helena", "Helena Sato", "helenasato", "oklch(0.58 0.17 300)"),
    user("user_joao", "João Pereira", "joaop", "oklch(0.6 0.12 200)"),
    user("user_marina", "Marina Lobo", "marinalobo", "oklch(0.62 0.14 70)", { playStyle: "game_master" }),
  ];

  const member = (userId: string, role: CampaignMember["role"], characterId: string | null = null): CampaignMember => ({
    userId,
    role,
    characterId,
    joinedAt: created,
  });

  const defaultPolicy = {
    maxPlayers: 5,
    playersCanEditSheets: true,
    playersCanMoveOwnToken: true,
    allowPrivateMessages: true,
    rollsPublicByDefault: true,
  };

  const campaigns: Campaign[] = [
    {
      id: "c_valdrith",
      name: "As Cinzas de Valdrith",
      tagline: "Um reino queimado, uma coroa perdida e quatro estranhos com motivos para encontrá-la.",
      systemId: "dnd5e",
      visualStyleId: "ember",
      status: "active",
      ownerId: DEMO_USER_ID,
      members: [
        member(DEMO_USER_ID, "game_master"),
        member("user_camila", "player", "ch_isolde"),
        member("user_davi", "player", "ch_grom"),
        member("user_helena", "player", "ch_nyx"),
        member("user_joao", "player", "ch_fen"),
      ],
      world: {
        name: "Valdrith",
        premise: "Vinte anos após o Incêndio Real, a capital ainda fumega e três casas disputam um trono vazio.",
        tone: ["Sombrio", "Político", "Heroico"],
        startingLocation: "Taverna do Corvo Rouco, nas muralhas de Cinzaporto",
      },
      gameMaster: { narratorName: "O Cronista", narrationStyle: "cinematic", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: at(-4, 23, 10),
      createdAt: at(-60),
      updatedAt: at(-4),
    },
    {
      id: "c_lamina",
      name: "Protocolo Lâmina Fria",
      tagline: "Um contrato simples numa megacidade onde nada é simples.",
      systemId: "cyberpunk-red",
      visualStyleId: "neon",
      status: "active",
      ownerId: "user_lia",
      members: [
        member("user_lia", "game_master"),
        member(DEMO_USER_ID, "player", "ch_kael"),
        member("user_camila", "player"),
        member("user_davi", "player"),
      ],
      world: {
        name: "Distrito Vértice",
        premise: "Uma corporação de biotecnologia esconde algo nos níveis inferiores da cidade.",
        tone: ["Ação", "Sombrio"],
        startingLocation: "Bar Estática, nível -3",
      },
      gameMaster: { narratorName: "Lia", narrationStyle: "tactical", notes: "" },
      playerPolicy: { ...defaultPolicy, maxPlayers: 4 },
      lastPlayedAt: at(-9, 22, 40),
      createdAt: at(-40),
      updatedAt: at(-9),
    },
    {
      id: "c_afogados",
      name: "Os Afogados de Porto Sereno",
      tagline: "Pescadores desaparecem. A maré devolve outra coisa.",
      systemId: "call-of-cthulhu",
      visualStyleId: "mist",
      status: "planning",
      ownerId: DEMO_USER_ID,
      members: [member(DEMO_USER_ID, "game_master"), member("user_helena", "player"), member("user_joao", "player")],
      world: {
        name: "Porto Sereno, 1926",
        premise: "Uma vila de pescadores no litoral sul onde todos sabem algo e ninguém fala.",
        tone: ["Horror", "Mistério"],
        startingLocation: "Pensão Dona Albertina",
      },
      gameMaster: { narratorName: "O Narrador", narrationStyle: "literary", notes: "" },
      playerPolicy: { ...defaultPolicy, maxPlayers: 4, rollsPublicByDefault: false },
      lastPlayedAt: null,
      createdAt: at(-6),
      updatedAt: at(-1),
    },
    {
      id: "c_saolazaro",
      name: "Sangue em São Lázaro",
      tagline: "A noite paulistana tem donos, e eles não gostam de recém-chegados.",
      systemId: "vampire-masquerade",
      visualStyleId: "obsidian",
      status: "paused",
      ownerId: "user_lia",
      members: [member("user_lia", "game_master"), member(DEMO_USER_ID, "player", "ch_celeste"), member("user_helena", "player")],
      world: {
        name: "São Lázaro",
        premise: "Uma cidade fictícia de concreto e neblina, dividida entre antigos pactos.",
        tone: ["Político", "Drama", "Horror"],
        startingLocation: "Edifício Aurora, 31º andar",
      },
      gameMaster: { narratorName: "Lia", narrationStyle: "literary", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: at(-45, 23, 50),
      createdAt: at(-150),
      updatedAt: at(-45),
    },
    {
      id: "c_ecos",
      name: "Ecos do Outro Lado",
      tagline: "Agentes recém-recrutados descobrem que a realidade tem frestas.",
      systemId: "ordem-paranormal",
      visualStyleId: "astral",
      status: "active",
      ownerId: "user_bruno",
      members: [
        member("user_bruno", "game_master"),
        member(DEMO_USER_ID, "player", "ch_tomas"),
        member("user_joao", "player"),
        member("user_camila", "player"),
      ],
      world: {
        name: "Brasil, dias atuais",
        premise: "Uma série de ocorrências inexplicáveis em cidades do interior.",
        tone: ["Horror", "Ação", "Mistério"],
        startingLocation: "Base regional da agência",
      },
      gameMaster: { narratorName: "Bruno", narrationStyle: "cinematic", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: at(-2, 22, 30),
      createdAt: at(-90),
      updatedAt: at(-2),
    },
    {
      id: "c_dragoes",
      name: "A Rota dos Dragões Partidos",
      tagline: "Uma caravana, um mapa rasgado em três e dragões que não deveriam existir.",
      systemId: "tormenta20",
      visualStyleId: "grove",
      status: "completed",
      ownerId: DEMO_USER_ID,
      members: [member(DEMO_USER_ID, "game_master"), member("user_davi", "player"), member("user_camila", "player")],
      world: {
        name: "Planícies de Orvalho",
        premise: "Rotas comerciais atravessam terras marcadas por uma antiga guerra.",
        tone: ["Épico", "Exploração"],
        startingLocation: "Entreposto de Pedra Torta",
      },
      gameMaster: { narratorName: "O Cronista", narrationStyle: "sandbox", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: at(-120, 23, 0),
      createdAt: at(-300),
      updatedAt: at(-120),
    },
    // Campaigns the demo user is invited to (not yet a member).
    {
      id: "c_ambar",
      name: "Expedição Âmbar",
      tagline: "Um mapa de âmbar fossilizado aponta para uma cidade sob o gelo.",
      systemId: "pathfinder2e",
      visualStyleId: "grove",
      status: "planning",
      ownerId: "user_bruno",
      members: [member("user_bruno", "game_master"), member("user_davi", "player")],
      world: { name: "Norte Gélido", premise: "Expedição a uma cidade perdida.", tone: ["Exploração"], startingLocation: "Acampamento base" },
      gameMaster: { narratorName: "Bruno", narrationStyle: "sandbox", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: null,
      createdAt: at(-3),
      updatedAt: at(-3),
    },
    {
      id: "c_torneio",
      name: "Torneio dos Cem Golpes",
      tagline: "Cem lutadores, uma arena flutuante e um prêmio que ninguém explica.",
      systemId: "3dt-victory",
      visualStyleId: "neon",
      status: "planning",
      ownerId: "user_marina",
      members: [member("user_marina", "game_master")],
      world: { name: "Arena Celeste", premise: "Torneio de artes marciais.", tone: ["Ação", "Comédia"], startingLocation: "Portões da arena" },
      gameMaster: { narratorName: "Marina", narrationStyle: "cinematic", notes: "" },
      playerPolicy: defaultPolicy,
      lastPlayedAt: null,
      createdAt: at(-1),
      updatedAt: at(-1),
    },
  ];

  const sessions: GameSession[] = [];
  const addSessions = (
    campaignId: string,
    attendees: string[],
    entries: { title: string; daysAgo: number; summary?: string; highlights?: string[]; minutes?: number }[],
    upcoming?: { title: string; inDays: number; hour?: number },
  ) => {
    entries.forEach((e, i) => {
      const when = at(-e.daysAgo, 20);
      sessions.push({
        id: `s_${campaignId}_${i + 1}`,
        campaignId,
        number: i + 1,
        title: e.title,
        status: "completed",
        scheduledAt: when,
        durationMinutes: e.minutes ?? 210,
        summary: e.summary ?? "",
        highlights: e.highlights ?? [],
        attendeeIds: attendees,
        createdAt: when,
        updatedAt: when,
      });
    });
    if (upcoming) {
      const when = at(upcoming.inDays, upcoming.hour ?? 20);
      sessions.push({
        id: `s_${campaignId}_${entries.length + 1}`,
        campaignId,
        number: entries.length + 1,
        title: upcoming.title,
        status: "scheduled",
        scheduledAt: when,
        durationMinutes: 240,
        summary: "",
        highlights: [],
        attendeeIds: attendees,
        createdAt: at(-1),
        updatedAt: at(-1),
      });
    }
  };

  addSessions(
    "c_valdrith",
    [DEMO_USER_ID, "user_camila", "user_davi", "user_helena", "user_joao"],
    [
      { title: "Fumaça sobre Cinzaporto", daysAgo: 39 },
      { title: "O contrato do Corvo", daysAgo: 32 },
      { title: "Sob as muralhas", daysAgo: 25 },
      { title: "A cripta dos três selos", daysAgo: 18, highlights: ["Grom segurou a porta enquanto o teto desabava"] },
      { title: "Cartas que não deveriam existir", daysAgo: 11 },
      {
        title: "O herdeiro de cinzas",
        daysAgo: 4,
        minutes: 245,
        summary:
          "O grupo invadiu o arquivo da Casa Morvane e descobriu que o herdeiro desaparecido nunca saiu da cidade. Nyx negociou com o arquivista em vez de lutar.",
        highlights: ["Nyx convenceu o arquivista a trair a Casa Morvane", "Fen encontrou o selo real escondido no forro"],
      },
    ],
    { title: "Audiência no Salão Rubro", inDays: 3 },
  );

  addSessions(
    "c_lamina",
    ["user_lia", DEMO_USER_ID, "user_camila", "user_davi"],
    [
      { title: "Chuva ácida e café ruim", daysAgo: 30 },
      { title: "Nível -7", daysAgo: 23 },
      {
        title: "Trinta segundos de silêncio",
        daysAgo: 9,
        summary: "A extração deu errado no último andar. Kael ficou para trás para cobrir a fuga.",
        highlights: ["Kael segurou o corredor sozinho"],
      },
    ],
    { title: "Quem paga a conta", inDays: 6, hour: 21 },
  );

  addSessions("c_afogados", [DEMO_USER_ID, "user_helena", "user_joao"], [], { title: "A pensão de Dona Albertina", inDays: 12, hour: 19 });

  addSessions(
    "c_saolazaro",
    ["user_lia", DEMO_USER_ID, "user_helena"],
    [
      { title: "Apresentação ao Conselho", daysAgo: 94 },
      { title: "A dívida do Príncipe", daysAgo: 80 },
      { title: "Vidros quebrados no 31º andar", daysAgo: 59 },
      { title: "Amanhecer adiado", daysAgo: 45, summary: "A crônica entrou em pausa após a revelação sobre o senhor de Celeste." },
    ],
  );

  addSessions(
    "c_ecos",
    ["user_bruno", DEMO_USER_ID, "user_joao", "user_camila"],
    [
      { title: "Recrutamento", daysAgo: 58 },
      { title: "A casa da Rua Sete", daysAgo: 51 },
      { title: "Estática", daysAgo: 44 },
      { title: "O que o rádio dizia", daysAgo: 37 },
      { title: "Fresta", daysAgo: 30 },
      { title: "Protocolo de contenção", daysAgo: 23 },
      { title: "Sangue no relatório", daysAgo: 16 },
      {
        title: "Do outro lado do espelho",
        daysAgo: 2,
        summary: "Tomás atravessou o espelho para resgatar a agente desaparecida e voltou com uma memória que não é dele.",
        highlights: ["Tomás atravessou o espelho", "O grupo selou a fresta com um ritual improvisado"],
      },
    ],
    { title: "Memórias emprestadas", inDays: 9, hour: 20 },
  );

  addSessions(
    "c_dragoes",
    [DEMO_USER_ID, "user_davi", "user_camila"],
    [
      { title: "O entreposto", daysAgo: 160 },
      { title: "A primeira parte do mapa", daysAgo: 146 },
      { title: "O dragão de vidro", daysAgo: 120, summary: "Final da campanha. A caravana chegou ao fim da rota.", highlights: ["Final da campanha"] },
    ],
  );

  const invites: CampaignInvite[] = [
    {
      id: "inv_ambar",
      campaignId: "c_ambar",
      campaignName: "Expedição Âmbar",
      systemId: "pathfinder2e",
      invitedById: "user_bruno",
      invitedByName: "Bruno Kaz",
      email: "mestre@rolequest.dev",
      message: "Falta alguém que segure a linha de frente. Sessões quinzenais aos sábados.",
      status: "pending",
      createdAt: at(-1, 14),
      updatedAt: at(-1, 14),
    },
    {
      id: "inv_torneio",
      campaignId: "c_torneio",
      campaignName: "Torneio dos Cem Golpes",
      systemId: "3dt-victory",
      invitedById: "user_marina",
      invitedByName: "Marina Lobo",
      email: "mestre@rolequest.dev",
      message: "One-shot leve, duas sessões. Traga seu golpe especial.",
      status: "pending",
      createdAt: at(0, 9),
      updatedAt: at(0, 9),
    },
  ];

  const ch = (
    id: string,
    ownerId: string,
    campaignId: string | null,
    systemId: Character["systemId"],
    name: string,
    concept: string,
    level: number | null,
    portraitColor: string,
    resources: Character["resources"],
    tags: string[] = [],
  ): Character => ({
    id,
    ownerId,
    campaignId,
    systemId,
    name,
    concept,
    level,
    portraitColor,
    avatarUrl: null,
    resources,
    tags,
    createdAt: at(-50),
    updatedAt: at(-3),
  });

  const hp = (current: number, max: number) => ({ key: "hp", label: "PV", current, max, color: "oklch(0.68 0.19 25)" });

  const characters: Character[] = [
    ch("ch_kael", DEMO_USER_ID, "c_lamina", "cyberpunk-red", "Kael Vantor", "Solo, ex-segurança corporativo", null, "oklch(0.6 0.17 350)", [
      hp(28, 40),
      { key: "humanity", label: "Humanidade", current: 38, max: 50, color: "oklch(0.78 0.06 260)" },
    ], ["Linha de frente"]),
    ch("ch_celeste", DEMO_USER_ID, "c_saolazaro", "vampire-masquerade", "Celeste Varga", "Aristocrata da noite, ex-noviça", null, "oklch(0.55 0.2 15)", [
      { key: "health", label: "Vitalidade", current: 5, max: 6, color: "oklch(0.68 0.19 25)" },
      { key: "hunger", label: "Fome", current: 3, max: 5, color: "oklch(0.55 0.2 15)" },
    ], ["Social"]),
    ch("ch_tomas", DEMO_USER_ID, "c_ecos", "ordem-paranormal", "Tomás Ribeiro", "Especialista, ex-perito criminal", 25, "oklch(0.6 0.15 300)", [
      hp(22, 30),
      { key: "san", label: "Sanidade", current: 14, max: 24, color: "oklch(0.74 0.12 300)" },
    ], ["Investigação"]),
    ch("ch_bryn", DEMO_USER_ID, null, "dnd5e", "Bryn Folhaseca", "Halfling, bardo itinerante", 3, "oklch(0.62 0.14 70)", [hp(21, 21)], ["Pronto para jogar"]),
    ch("ch_isolde", "user_camila", "c_valdrith", "dnd5e", "Isolde Marr", "Humana, paladina juramentada", 5, "oklch(0.62 0.12 230)", [hp(38, 44)]),
    ch("ch_grom", "user_davi", "c_valdrith", "dnd5e", "Grom Pedra-Funda", "Anão, guerreiro", 5, "oklch(0.6 0.12 50)", [hp(31, 52)]),
    ch("ch_nyx", "user_helena", "c_valdrith", "dnd5e", "Nyx", "Tiefling, feiticeira", 5, "oklch(0.58 0.17 300)", [hp(24, 27)]),
    ch("ch_fen", "user_joao", "c_valdrith", "dnd5e", "Fen Ventolargo", "Meio-elfo, patrulheiro", 5, "oklch(0.6 0.13 150)", [hp(36, 40)]),
  ];

  const asset = (
    id: string,
    kind: LibraryAsset["kind"],
    title: string,
    description: string,
    opts: Partial<LibraryAsset>,
  ): LibraryAsset => ({
    id,
    ownerId: DEMO_USER_ID,
    kind,
    title,
    description,
    biome: null,
    category: null,
    tags: [],
    systemIds: [],
    itemCount: 1,
    previewGradient: ["oklch(0.3 0.04 270)", "oklch(0.18 0.01 270)"],
    createdAt: at(-30),
    updatedAt: at(-5),
    ...opts,
  });

  const library: LibraryAsset[] = [
    asset("lib_corvo", "scenario", "Taverna do Corvo Rouco", "Dois andares, porão com passagem secreta e mesa de jogos.", {
      biome: "interior",
      itemCount: 6,
      tags: ["Taverna", "Cidade"],
      systemIds: ["dnd5e"],
      previewGradient: ["oklch(0.36 0.08 55)", "oklch(0.18 0.02 40)"],
    }),
    asset("lib_cripta", "scenario", "Cripta dos Três Selos", "Masmorra em três níveis com armadilhas ocultas.", {
      biome: "dungeon",
      itemCount: 14,
      tags: ["Masmorra", "Armadilhas"],
      systemIds: ["dnd5e", "pathfinder2e"],
      previewGradient: ["oklch(0.28 0.03 270)", "oklch(0.14 0.01 270)"],
    }),
    asset("lib_docas", "scenario", "Docas de Porto Sereno", "Píeres, armazéns e o farol desativado.", {
      biome: "city",
      itemCount: 9,
      tags: ["Litoral", "Noite"],
      systemIds: ["call-of-cthulhu"],
      previewGradient: ["oklch(0.32 0.05 210)", "oklch(0.16 0.02 230)"],
    }),
    asset("lib_clareira", "scenario", "Clareira dos Sussurros", "Floresta densa com círculo de pedras.", {
      biome: "forest",
      itemCount: 3,
      tags: ["Floresta", "Ritual"],
      previewGradient: ["oklch(0.33 0.08 150)", "oklch(0.16 0.03 160)"],
    }),
    asset("lib_kestrel", "scenario", "Estação Kestrel", "Corredores modulares, hangar e núcleo do reator.", {
      biome: "futuristic",
      itemCount: 11,
      tags: ["Sci-fi"],
      systemIds: ["cyberpunk-red", "gurps"],
      previewGradient: ["oklch(0.32 0.1 320)", "oklch(0.15 0.04 270)"],
    }),
    asset("lib_tiles_dungeon", "resource", "Masmorras modulares", "Pisos, paredes, portas e escadas em grade de 1×1.", {
      category: "tileset",
      itemCount: 148,
      tags: ["Masmorra"],
      previewGradient: ["oklch(0.3 0.02 270)", "oklch(0.2 0.01 270)"],
    }),
    asset("lib_tiles_neon", "resource", "Ruas de neon", "Calçadas, letreiros e veículos para cenários urbanos futuristas.", {
      category: "tileset",
      itemCount: 96,
      tags: ["Futurista"],
      previewGradient: ["oklch(0.34 0.13 330)", "oklch(0.18 0.05 280)"],
    }),
    asset("lib_tokens", "resource", "Bestiário genérico", "Tokens de criaturas sem marca de cenário.", {
      category: "token-pack",
      itemCount: 64,
      tags: ["Criaturas"],
      previewGradient: ["oklch(0.34 0.09 30)", "oklch(0.17 0.02 20)"],
    }),
    asset("lib_audio_storm", "resource", "Chuva e trovão", "Camadas de chuva, vento e trovões distantes.", {
      category: "audio-pack",
      itemCount: 12,
      tags: ["Ambiente"],
      previewGradient: ["oklch(0.3 0.05 240)", "oklch(0.16 0.02 250)"],
    }),
    asset("lib_audio_tavern", "resource", "Taverna viva", "Conversas, copos e alaúde ao fundo.", {
      category: "audio-pack",
      itemCount: 9,
      tags: ["Ambiente", "Taverna"],
      previewGradient: ["oklch(0.34 0.08 60)", "oklch(0.18 0.03 40)"],
    }),
    asset("lib_handouts", "resource", "Cartas e mapas antigos", "Modelos de documentos para entregar aos jogadores.", {
      category: "handout",
      itemCount: 18,
      tags: ["Documentos"],
      previewGradient: ["oklch(0.4 0.05 80)", "oklch(0.22 0.02 60)"],
    }),
  ];

  return { users, campaigns, sessions, invites, characters: characters.map(withDemoSheet), library, customSystems: [] };
}
