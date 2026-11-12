/**
 * The person's account: plan and credits, payment pages, reminders, a copy of
 * their data (LGPD, right of access and portability) and account deletion.
 */
import { repositories } from "@/repositories";
import type { CreditPackId, PlanId } from "@/config/plans";
import type { UserProfile } from "@/types/user";

export const accountService = {
  billing: () => repositories().account.billing(),
  checkoutPlan: (plan: Exclude<PlanId, "free">) => repositories().account.checkout({ plan }),
  checkoutCredits: (credits: CreditPackId) => repositories().account.checkout({ credits }),
  portal: () => repositories().account.portal(),
  watermarkFor: (campaignId: string) => repositories().account.watermarkFor(campaignId).catch(() => false),
  emailReminders: (user: Pick<UserProfile, "id">) => repositories().account.emailReminders(user.id),
  setEmailReminders: (user: Pick<UserProfile, "id">, on: boolean) => repositories().account.setEmailReminders(user.id, on),

  /** Everything the person can see that is theirs or about them, as one JSON document. */
  async exportData(user: UserProfile): Promise<Blob> {
    const repo = repositories();
    const campaigns = await repo.campaigns.listForUser(user.id);
    const ids = campaigns.map((c) => c.id);
    const owned = campaigns.filter((c) => c.ownerId === user.id).map((c) => c.id);
    const [sessions, characters, systems, library, journal, npcs] = await Promise.all([
      repo.sessions.listForCampaigns(ids),
      repo.characters.listForUser(user.id),
      repo.systems.listCustom(user.id),
      repo.library.listForUser(user.id),
      Promise.all(owned.map((id) => repo.journal.listForCampaign(id))).then((l) => l.flat()),
      Promise.all(owned.map((id) => repo.npcs.listForCampaign(id))).then((l) => l.flat()),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      format: "role-quest-export/1",
      profile: user,
      campaigns,
      sessions,
      characters,
      customSystems: systems,
      library,
      ownedCampaignJournal: journal,
      ownedCampaignNpcs: npcs,
      billing: await repo.account.billing().catch(() => null),
    };
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  },

  remove: (user: Pick<UserProfile, "id">) => repositories().account.remove(user.id),
};
