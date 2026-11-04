/**
 * Demo GM tools for "As Cinzas de Valdrith": NPCs with secrets, a ready
 * encounter and a few journal entries from earlier sessions.
 * Imported ONLY by the mock repositories.
 */
import type { Encounter, JournalEntry, Npc } from "@/types/gm";

const CAMPAIGN = "c_valdrith";

export function seedGmTools(now: Date): { npcs: Npc[]; encounters: Encounter[]; journal: JournalEntry[] } {
  const daysAgo = (d: number, h = 21) => {
    const at = new Date(now);
    at.setDate(at.getDate() - d);
    at.setHours(h, 0, 0, 0);
    return at.toISOString();
  };
  const stamp = { createdAt: daysAgo(30), updatedAt: daysAgo(4) };

  const npcs: Npc[] = [
    {
      ...stamp,
      id: "npc_mira",
      campaignId: CAMPAIGN,
      name: "Mira Fumaça",
      concept: "Taverneira do Corvo Rouco",
      attitude: "ally",
      portraitColor: "oklch(0.65 0.13 60)",
      location: "Taverna do Corvo Rouco, Cinzaporto",
      description: "Dona da taverna nas muralhas. Ouve tudo, serve todos e cobra em informação.",
      secretNotes: "Contrabandeia cartas para a Casa Vex. Trai o grupo se a taverna for ameaçada.",
      facts: [
        { id: "f_mira_1", text: "Ela guarda um mapa do subsolo da cidade velha atrás do balcão.", revealed: true, revealedAt: daysAgo(18) },
        { id: "f_mira_2", text: "Recebe uma carta lacrada com o brasão Vex toda lua nova.", revealed: false },
        { id: "f_mira_3", text: "Perdeu o irmão no Incêndio Real e culpa a coroa, não as casas.", revealed: false },
      ],
      stats: { hp: 11, defense: 12, attackBonus: 3, damage: "1d4+1", speed: 6, initiativeBonus: 2, attackName: "Adaga escondida" },
      known: true,
    },
    {
      ...stamp,
      id: "npc_vex",
      campaignId: CAMPAIGN,
      name: "Lorde Aldren Vex",
      concept: "Nobre da Casa Vex",
      attitude: "neutral",
      portraitColor: "oklch(0.55 0.14 300)",
      location: "Salão Rubro",
      description: "Herdeiro sorridente de uma das três casas que disputam o trono vazio.",
      secretNotes: "Financia os saqueadores da estrada norte para enfraquecer a Casa Orrin.",
      facts: [
        { id: "f_vex_1", text: "Usa um anel com uma pedra que esquenta perto de magia.", revealed: false },
        { id: "f_vex_2", text: "Os saqueadores da estrada norte carregam moedas cunhadas pela Casa Vex.", revealed: false },
      ],
      stats: { hp: 27, defense: 15, attackBonus: 5, damage: "1d8+3", speed: 6, initiativeBonus: 2, attackName: "Florete" },
      known: true,
    },
    {
      ...stamp,
      id: "npc_raider",
      campaignId: CAMPAIGN,
      name: "Saqueador da estrada",
      concept: "Bandido · arco curto",
      attitude: "hostile",
      portraitColor: "oklch(0.55 0.19 25)",
      modelId: "archer",
      location: "Estrada norte",
      description: "Mercenários de capa cinza que atacam caravanas.",
      secretNotes: "Pagos pela Casa Vex (ver Lorde Aldren).",
      facts: [{ id: "f_raider_1", text: "Todos têm a mesma tatuagem de corvo no pulso.", revealed: false }],
      stats: { hp: 11, defense: 12, attackBonus: 4, damage: "1d6+2", speed: 6, initiativeBonus: 1, attackName: "Arco curto", range: 6 },
      known: false,
    },
  ];

  const encounters: Encounter[] = [
    {
      ...stamp,
      id: "enc_estrada",
      campaignId: CAMPAIGN,
      name: "Emboscada na estrada norte",
      description: "Os saqueadores atiram da mata e fogem se metade cair.",
      entries: [{ npcId: "npc_raider", count: 3 }],
    },
  ];

  const s5 = "Sessão 5 · O mapa rasgado";
  const s6 = "Sessão 6 · Cinzas na estrada";
  const journal: JournalEntry[] = [
    { ...stamp, id: "jr_1", campaignId: CAMPAIGN, at: daysAgo(18, 20), sessionLabel: s5, kind: "reveal", text: "Mira Fumaça mostrou ao grupo um mapa do subsolo da cidade velha.", private: false },
    { ...stamp, id: "jr_2", campaignId: CAMPAIGN, at: daysAgo(18, 22), sessionLabel: s5, kind: "epic", text: "Isolde desarmou o duelista da Casa Orrin com um único golpe.", private: false },
    { ...stamp, id: "jr_3", campaignId: CAMPAIGN, at: daysAgo(11, 21), sessionLabel: s6, kind: "combat", text: "Combate na estrada norte: o grupo venceu três saqueadores.", private: false },
    { ...stamp, id: "jr_4", campaignId: CAMPAIGN, at: daysAgo(11, 23), sessionLabel: s6, kind: "note", text: "Os saqueadores fugiram para o norte: preparar o acampamento deles e a ligação com Vex.", private: true },
  ];

  return { npcs, encounters, journal };
}
