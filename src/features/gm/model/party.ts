import type { CampaignOverview } from "@/services/campaign.service";

/** Label the journal files the table's moments under: the session being played, else the next one. */
export function sessionLabelOf(overview: Pick<CampaignOverview, "currentSession" | "upcomingSessions">): string {
  const s = overview.currentSession ?? overview.upcomingSessions[0];
  return s ? `Sessão ${s.number} · ${s.title}` : "Sessão avulsa";
}

/** Size and average level of the party (characters linked to the campaign), for encounter difficulty. */
export function partyOf(overview: Pick<CampaignOverview, "members">): { players: number; level: number } {
  const chars = overview.members.filter((m) => m.role === "player" && m.character).map((m) => m.character!);
  const levels = chars.map((c) => c.level ?? 1);
  return { players: Math.max(1, chars.length), level: levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1 };
}
