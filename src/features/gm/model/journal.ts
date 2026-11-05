/**
 * The campaign journal written from what happened at the table: combats,
 * falls, traps, revelations, epic moments and critical rolls. Pure: it reads
 * the room's public messages and skips what is already recorded.
 */
import type { ChatMessage } from "@/features/virtual-tabletop/model/types";
import type { JournalInput, JournalKind } from "@/types/gm";

/** Prefix of the system message posted when the GM reveals an NPC fact. */
export const REVEAL_PREFIX = "Sobre ";

/** System lines the GM sees that still belong in the journal (they name everyone; the fight is over when players read it). */
const GM_LINES = ["Combate! Iniciativa: ", "Entram no combate: "];

function classify(m: ChatMessage): { kind: JournalKind; text: string; private?: boolean } | null {
  const gmLine = m.kind === "system" && GM_LINES.some((p) => m.text.startsWith(p));
  if (m.visibility !== "public" && !gmLine) return null;
  // They name creatures the party may not have seen: GM-only entries.
  if (gmLine) {
    const entry = classifyText(m.text);
    return entry && { ...entry, private: true };
  }
  if (m.kind === "epic") return { kind: "epic", text: m.text };
  if (m.kind === "roll" && m.roll) {
    const what = m.text.replace(/\.$/, "");
    if (m.roll.natural === 20) return { kind: "critical", text: `${m.author.name} tirou 20 natural: ${what}.` };
    if (m.roll.natural === 1) return { kind: "critical", text: `${m.author.name} tirou 1 natural: ${what}.` };
    return null;
  }
  if (m.kind !== "system") return null;
  return classifyText(m.text);
}

function classifyText(t: string): { kind: JournalKind; text: string } | null {
  if (t.startsWith("Combate! Iniciativa: ")) {
    const who = t.replace("Combate! Iniciativa: ", "").split(" · ").map((x) => x.replace(/ -?[\d.]+$/, ""));
    return { kind: "combat", text: `Começou um combate: ${who.join(", ")}.` };
  }
  if (t.startsWith("Entram no combate: ")) return { kind: "combat", text: `Reforços: ${t.replace("Entram no combate: ", "").split(" · ").map((x) => x.replace(/ -?[\d.]+$/, "")).join(", ")}.` };
  if (/^(Vitória!|O grupo foi derrotado|O combate terminou)/.test(t)) return { kind: "combat", text: t };
  if (/caiu!$|está fora de combate\.$/.test(t)) return { kind: "down", text: t };
  if (/ ativou: /.test(t)) return { kind: "trap", text: t };
  if (t.startsWith("O mestre atualizou o mapa: ")) return { kind: "map", text: t.replace("O mestre atualizou o mapa: ", "O grupo chegou a: ") };
  if (t.startsWith(REVEAL_PREFIX)) return { kind: "reveal", text: t };
  return null;
}

/** New journal entries from the room's messages (oldest first), skipping sources already recorded. */
export function journalFromMessages(messages: ChatMessage[], campaignId: string, sessionLabel: string, recorded: Set<string>): JournalInput[] {
  const out: JournalInput[] = [];
  for (const m of messages) {
    if (recorded.has(m.id)) continue;
    const entry = classify(m);
    if (entry) out.push({ campaignId, at: m.at, sessionLabel, kind: entry.kind, text: entry.text, private: entry.private ?? false, sourceId: m.id });
  }
  return out;
}

export const JOURNAL_KIND_LABEL: Record<JournalKind, string> = {
  combat: "Combate",
  down: "Queda",
  trap: "Armadilha",
  epic: "Momento épico",
  critical: "Crítico",
  reveal: "Revelação",
  map: "Lugar",
  note: "Anotação",
};

/** Groups entries by session, keeping the order they happened in. */
export function groupBySession<T extends { sessionLabel: string; at: string }>(entries: T[]): { session: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const e of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const list = groups.get(e.sessionLabel) ?? [];
    list.push(e);
    groups.set(e.sessionLabel, list);
  }
  return [...groups].map(([session, list]) => ({ session, entries: list }));
}
