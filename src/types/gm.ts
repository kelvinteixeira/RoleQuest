import type { NpcStatBlock } from "@/features/combat/model/types";
import type { ID, ISODateString, Timestamps } from "./common";

export type NpcAttitude = "ally" | "neutral" | "hostile";

/** Something about an NPC the players can learn; hidden until the GM reveals it. */
export interface NpcFact {
  id: ID;
  text: string;
  revealed: boolean;
  revealedAt?: ISODateString;
}

export interface Npc extends Timestamps {
  id: ID;
  campaignId: ID;
  name: string;
  concept: string;
  attitude: NpcAttitude;
  portraitColor: string;
  /** 3D model at the table; a guess from the concept when missing. */
  modelId?: string;
  location: string;
  /** What players see once they know the NPC. */
  description: string;
  /** GM only. */
  secretNotes: string;
  facts: NpcFact[];
  /** Combat block in d20 terms, adapted to the campaign system at the table. */
  stats: NpcStatBlock;
  /** Players know this NPC exists (met at the table or revealed by the GM). */
  known: boolean;
}

export type NpcInput = Omit<Npc, "id" | "createdAt" | "updatedAt">;

export interface EncounterEntry {
  npcId: ID;
  count: number;
}

export interface Encounter extends Timestamps {
  id: ID;
  campaignId: ID;
  name: string;
  description: string;
  entries: EncounterEntry[];
}

export type EncounterInput = Omit<Encounter, "id" | "createdAt" | "updatedAt">;

export type JournalKind = "combat" | "down" | "trap" | "epic" | "critical" | "reveal" | "map" | "note";

export interface JournalEntry extends Timestamps {
  id: ID;
  campaignId: ID;
  /** When it happened at the table (or when the GM wrote it). */
  at: ISODateString;
  /** "Sessão 7 · Audiência no Salão Rubro". */
  sessionLabel: string;
  kind: JournalKind;
  text: string;
  /** GM-only entry. */
  private: boolean;
  /** Room message it came from, so recording twice adds nothing. */
  sourceId?: string;
  /** Removed by the GM but kept as a marker so the table can't record it again. */
  dismissed?: boolean;
}

export type JournalInput = Omit<JournalEntry, "id" | "createdAt" | "updatedAt">;
