import { repositories } from "@/repositories";
import { buildCampaignCards, isUpcoming, type CampaignCardModel } from "./campaign.service";
import { collectionService, type CharacterCardModel } from "./collection.service";
import { systemService, toSummary, type SystemSummary } from "./system.service";
import type { GameSession } from "@/types/campaign";
import type { UserProfile } from "@/types/user";

export interface SessionWithCampaign {
  session: GameSession;
  campaign: CampaignCardModel;
}

export interface DashboardData {
  stats: { activeCampaigns: number; sessionsThisMonth: number; characters: number; hoursPlayed: number };
  recent: CampaignCardModel[];
  inProgress: CampaignCardModel[];
  upcoming: SessionWithCampaign[];
  history: SessionWithCampaign[];
  characters: CharacterCardModel[];
  systems: SystemSummary[];
  library: { characters: number; scenarios: number; resources: number };
}

/** Aggregates everything the dashboard shows in one round of parallel reads. */
export const dashboardService = {
  async load(user: Pick<UserProfile, "id">): Promise<DashboardData> {
    const repo = repositories();
    const campaigns = await repo.campaigns.listForUser(user.id);

    const [sessions, characters, library, systems] = await Promise.all([
      repo.sessions.listForCampaigns(campaigns.map((c) => c.id)),
      collectionService.listCharacters(user.id),
      repo.library.listForUser(user.id),
      systemService.listForUser(user.id),
    ]);

    const cards = await buildCampaignCards(campaigns, user.id, sessions);
    const cardById = new Map(cards.map((c) => [c.campaign.id, c]));
    const withCampaign = (s: GameSession): SessionWithCampaign => ({ session: s, campaign: cardById.get(s.campaignId)! });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const completed = sessions.filter((s) => s.status === "completed");
    const lastActivity = (c: CampaignCardModel) => c.campaign.lastPlayedAt ?? c.campaign.updatedAt;

    return {
      stats: {
        activeCampaigns: campaigns.filter((c) => c.status === "active").length,
        sessionsThisMonth: completed.filter((s) => new Date(s.scheduledAt).getTime() >= monthStart).length,
        characters: characters.length,
        hoursPlayed: Math.round(completed.reduce((sum, s) => sum + s.durationMinutes, 0) / 60),
      },
      recent: [...cards].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))).slice(0, 6),
      inProgress: cards.filter((c) => c.campaign.status === "active" || c.campaign.status === "planning"),
      upcoming: sessions
        .filter((s) => isUpcoming(s, now.getTime()))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, 4)
        .map(withCampaign),
      history: completed
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        .slice(0, 6)
        .map(withCampaign),
      characters: characters.slice(0, 8),
      systems: systems.map(toSummary),
      library: {
        characters: characters.length,
        scenarios: library.filter((a) => a.kind === "scenario").length,
        resources: library.filter((a) => a.kind === "resource").length,
      },
    };
  },
};
