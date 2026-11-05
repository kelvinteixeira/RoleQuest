/**
 * The best moments of a campaign, from its journal: each entry gets a drama
 * score (an epic moment beats a trap, a natural 20 beats a plain hit, a fallen
 * hero beats a fallen goblin) and the highlights are the top ones, told in
 * the order they happened.
 */
import type { ChronicleMoment } from "@/types/chronicle";
import type { JournalEntry, JournalKind } from "@/types/gm";

const BASE: Record<JournalKind, number> = { epic: 10, critical: 6, down: 6, reveal: 6, combat: 5, trap: 5, map: 3, note: 3 };

/** How dramatic an entry is (0–12). */
export function dramaScore(kind: JournalKind, text: string): number {
  let score = BASE[kind] ?? 3;
  if (kind === "critical" && /20 natural/.test(text)) score += 3;
  if (kind === "critical" && /1 natural/.test(text)) score += 1;
  if (kind === "critical" && /Ataque|Dano/.test(text)) score += 1;
  if (kind === "down" && /caiu!$/.test(text)) score += 2;
  if (kind === "combat" && /^(Vitória!|O grupo foi derrotado)/.test(text)) score += 3;
  return Math.min(12, score);
}

/** The journal as moments (dismissed entries are left out). */
export function momentsFromJournal(entries: JournalEntry[]): ChronicleMoment[] {
  return entries
    .filter((e) => !e.dismissed)
    .map((e) => ({ id: e.id, at: e.at, sessionLabel: e.sessionLabel, kind: e.kind, text: e.text, score: dramaScore(e.kind, e.text), private: e.private }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * The highlights: the highest-scoring public moments (later ones win ties), at
 * least one per session when there is room, back in story order.
 */
export function pickHighlights(all: ChronicleMoment[], max = 10): ChronicleMoment[] {
  // GM-only entries are never picked for the GM: they choose them knowingly.
  const moments = all.filter((m) => !m.private);
  if (moments.length <= max) return [...moments];
  const ranked = [...moments].sort((a, b) => b.score - a.score || b.at.localeCompare(a.at));
  const chosen = new Map<string, ChronicleMoment>();
  // The best of each session first, so a quiet session still gets its beat.
  const sessions = [...new Set(moments.map((m) => m.sessionLabel))];
  if (sessions.length <= max) for (const s of sessions) {
    const best = ranked.find((m) => m.sessionLabel === s);
    if (best) chosen.set(best.id, best);
  }
  for (const m of ranked) {
    if (chosen.size >= max) break;
    chosen.set(m.id, m);
  }
  return [...chosen.values()].sort((a, b) => a.at.localeCompare(b.at));
}
