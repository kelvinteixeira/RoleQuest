import { repositories } from "@/repositories";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { roleOf } from "./campaign.service";
import { playerView, validateNpc, type KnownNpc } from "@/features/gm/model/npc";

const TEXT_MAX = 500;
import type { ID } from "@/types/common";
import type { Encounter, EncounterInput, JournalEntry, JournalInput, JournalKind, Npc, NpcInput } from "@/types/gm";
import type { UserProfile } from "@/types/user";

type Actor = Pick<UserProfile, "id">;

async function membership(campaignId: ID, user: Actor) {
  const campaign = await repositories().campaigns.getById(campaignId);
  if (!campaign) throw new AppError("not_found", "Campanha não encontrada.");
  const role = roleOf(campaign, user.id);
  if (!role) throw new AppError("forbidden", "Você não participa desta campanha.");
  return { campaign, role, isGM: can(role, "npc:manage") };
}

/** NPCs, encounters and the journal belong to the GM; players read only what was revealed or made public. */
async function requireGM(campaignId: ID, user: Actor) {
  const m = await membership(campaignId, user);
  if (!m.isGM) throw new AppError("forbidden", "Só o mestre da campanha pode fazer isso.");
  return m;
}

async function ownNpc(campaignId: ID, npcId: ID): Promise<Npc> {
  const npc = await repositories().npcs.getById(npcId);
  if (!npc || npc.campaignId !== campaignId) throw new AppError("not_found", "NPC não encontrado.");
  return npc;
}

function checkNpc(input: Pick<NpcInput, "name" | "stats">) {
  const errors = validateNpc(input);
  if (Object.keys(errors).length) throw new AppError("validation", Object.values(errors)[0], errors);
}

export const gmService = {
  /* ---------- NPCs ---------- */

  async listNpcs(campaignId: ID, user: Actor): Promise<Npc[]> {
    await requireGM(campaignId, user);
    return repositories().npcs.listForCampaign(campaignId);
  },

  /** For any member: the NPCs the party knows, with only revealed facts. */
  async knownNpcs(campaignId: ID, user: Actor): Promise<KnownNpc[]> {
    await membership(campaignId, user);
    // The backend already strips secrets; playerView is a second, local filter.
    const npcs = await repositories().npcs.listKnownForCampaign(campaignId);
    return npcs.map(playerView).filter((n): n is KnownNpc => n !== null);
  },

  async createNpc(campaignId: ID, user: Actor, input: Omit<NpcInput, "campaignId">): Promise<Npc> {
    await requireGM(campaignId, user);
    checkNpc(input);
    return repositories().npcs.create({ ...input, name: input.name.trim(), campaignId });
  },

  async updateNpc(campaignId: ID, user: Actor, npcId: ID, patch: Partial<Omit<NpcInput, "campaignId">>): Promise<Npc> {
    await requireGM(campaignId, user);
    const current = await ownNpc(campaignId, npcId);
    checkNpc({ name: patch.name ?? current.name, stats: patch.stats ?? current.stats });
    return repositories().npcs.update(npcId, patch.name ? { ...patch, name: patch.name.trim() } : patch);
  },

  async removeNpc(campaignId: ID, user: Actor, npcId: ID): Promise<void> {
    await requireGM(campaignId, user);
    await ownNpc(campaignId, npcId);
    await repositories().npcs.remove(npcId);
  },

  /** Reveals (or hides again) one fact; revealing makes the NPC known to the party. */
  async setFactRevealed(campaignId: ID, user: Actor, npcId: ID, factId: ID, revealed: boolean): Promise<Npc> {
    await requireGM(campaignId, user);
    const npc = await ownNpc(campaignId, npcId);
    if (!npc.facts.some((f) => f.id === factId)) throw new AppError("not_found", "Fato não encontrado.");
    const at = new Date().toISOString();
    const facts = npc.facts.map((f) => (f.id === factId ? { ...f, revealed, revealedAt: revealed ? at : undefined } : f));
    return repositories().npcs.update(npcId, { facts, known: revealed ? true : npc.known });
  },

  /* ---------- Encounters ---------- */

  async listEncounters(campaignId: ID, user: Actor): Promise<Encounter[]> {
    await requireGM(campaignId, user);
    return repositories().encounters.listForCampaign(campaignId);
  },

  async saveEncounter(campaignId: ID, user: Actor, input: Omit<EncounterInput, "campaignId"> & { id?: ID }): Promise<Encounter> {
    await requireGM(campaignId, user);
    const name = input.name.trim();
    if (!name) throw new AppError("validation", "Dê um nome ao encontro.", { name: "Dê um nome ao encontro." });
    const npcIds = new Set((await repositories().npcs.listForCampaign(campaignId)).map((n) => n.id));
    // Only this campaign's NPCs, at least one of each, at most 20.
    // Entries for the same NPC are merged (so tokens are numbered 1..n once).
    const counts = new Map<string, number>();
    for (const e of input.entries) {
      if (!npcIds.has(e.npcId)) continue;
      const count = Number.isFinite(e.count) ? Math.round(e.count) : 1;
      counts.set(e.npcId, (counts.get(e.npcId) ?? 0) + Math.max(1, count));
    }
    const entries = [...counts].map(([npcId, count]) => ({ npcId, count: Math.min(20, count) }));
    const data = { campaignId, name, description: input.description.trim(), entries };
    if (input.id) {
      const existing = (await repositories().encounters.listForCampaign(campaignId)).find((e) => e.id === input.id);
      if (!existing) throw new AppError("not_found", "Encontro não encontrado.");
      return repositories().encounters.update(input.id, data);
    }
    return repositories().encounters.create(data);
  },

  async removeEncounter(campaignId: ID, user: Actor, encounterId: ID): Promise<void> {
    await requireGM(campaignId, user);
    const existing = (await repositories().encounters.listForCampaign(campaignId)).find((e) => e.id === encounterId);
    if (!existing) throw new AppError("not_found", "Encontro não encontrado.");
    await repositories().encounters.remove(encounterId);
  },

  /* ---------- Journal ---------- */

  /**
   * The GM sees everything (and which table messages are already recorded or
   * dismissed); players see public entries only.
   */
  async listJournal(campaignId: ID, user: Actor): Promise<{ entries: JournalEntry[]; isGM: boolean; recordedSources: string[] }> {
    const { isGM } = await membership(campaignId, user);
    const all = await repositories().journal.listForCampaign(campaignId);
    const live = all.filter((e) => !e.dismissed);
    return {
      entries: isGM ? live : live.filter((e) => !e.private),
      isGM,
      recordedSources: isGM ? all.flatMap((e) => (e.sourceId ? [e.sourceId] : [])) : [],
    };
  },

  /** Records entries generated from the table, skipping sources already recorded or dismissed. */
  async record(campaignId: ID, user: Actor, entries: JournalInput[]): Promise<JournalEntry[]> {
    await requireGM(campaignId, user);
    const existing = await repositories().journal.listForCampaign(campaignId);
    const seen = new Set(existing.map((e) => e.sourceId).filter(Boolean));
    const fresh: JournalInput[] = [];
    for (const e of entries) {
      if (e.campaignId !== campaignId || !e.text.trim() || (e.sourceId && seen.has(e.sourceId))) continue;
      if (e.sourceId) seen.add(e.sourceId);
      fresh.push({ ...e, text: e.text.trim().slice(0, TEXT_MAX), dismissed: undefined });
    }
    return fresh.length ? repositories().journal.add(fresh) : [];
  },

  async addNote(campaignId: ID, user: Actor, note: { text: string; sessionLabel: string; private: boolean; kind?: JournalKind }): Promise<JournalEntry> {
    await requireGM(campaignId, user);
    const text = note.text.trim();
    if (!text) throw new AppError("validation", "Escreva algo.", { text: "Escreva algo." });
    const [entry] = await repositories().journal.add([
      { campaignId, at: new Date().toISOString(), sessionLabel: note.sessionLabel.trim() || "Entre sessões", kind: note.kind ?? "note", text: text.slice(0, TEXT_MAX), private: note.private },
    ]);
    return entry;
  },

  async updateEntry(campaignId: ID, user: Actor, entryId: ID, patch: Partial<Pick<JournalEntry, "text" | "private">>): Promise<JournalEntry> {
    await requireGM(campaignId, user);
    const entry = (await repositories().journal.listForCampaign(campaignId)).find((e) => e.id === entryId);
    if (!entry) throw new AppError("not_found", "Entrada não encontrada.");
    if (patch.text !== undefined && !patch.text.trim()) throw new AppError("validation", "Escreva algo.");
    return repositories().journal.update(entryId, patch.text !== undefined ? { ...patch, text: patch.text.trim().slice(0, TEXT_MAX) } : patch);
  },

  /** Notes are deleted; entries recorded from the table become hidden markers so they can't come back. */
  async removeEntry(campaignId: ID, user: Actor, entryId: ID): Promise<void> {
    await requireGM(campaignId, user);
    const entry = (await repositories().journal.listForCampaign(campaignId)).find((e) => e.id === entryId && !e.dismissed);
    if (!entry) throw new AppError("not_found", "Entrada não encontrada.");
    if (entry.sourceId) await repositories().journal.update(entryId, { dismissed: true, private: true });
    else await repositories().journal.remove(entryId);
  },
};
