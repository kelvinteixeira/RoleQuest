/**
 * Local mode has no payments: everyone has every allowance and the demo
 * account shows the top plan. Deleting removes the user's data from this
 * browser's database.
 */
import { AppError } from "@/lib/errors";
import type { AccountRepository } from "../contracts";
import { commit, getDb, respond } from "./database";

const reminders = new Map<string, boolean>();

export const mockAccount: AccountRepository = {
  async billing() {
    return respond({ plan: "mesa" as const, enforced: false, status: null, renewsAt: null, cancelAtPeriodEnd: false, credits: 0, usedToday: {} });
  },
  async checkout() {
    throw new AppError("validation", "Pagamentos só funcionam com o Supabase e o Stripe configurados (modo local não cobra nada).");
  },
  async portal() {
    throw new AppError("validation", "Pagamentos só funcionam com o Supabase e o Stripe configurados.");
  },
  async watermarkFor() {
    return respond(false);
  },
  async emailReminders(userId) {
    return respond(reminders.get(userId) ?? true);
  },
  async setEmailReminders(userId, on) {
    reminders.set(userId, on);
    return respond(undefined);
  },
  async remove(userId) {
    const db = getDb();
    const owned = new Set(db.campaigns.filter((c) => c.ownerId === userId).map((c) => c.id));
    db.campaigns = db.campaigns.filter((c) => !owned.has(c.id)).map((c) => ({ ...c, members: c.members.filter((m) => m.userId !== userId) }));
    db.sessions = db.sessions.filter((s) => !owned.has(s.campaignId));
    db.inviteLinks = db.inviteLinks.filter((l) => !owned.has(l.campaignId));
    db.episodes = db.episodes.filter((e) => !owned.has(e.campaignId));
    db.audioTracks = db.audioTracks.filter((t) => !owned.has(t.campaignId));
    db.maps = db.maps.filter((m) => !owned.has(m.campaignId));
    db.npcs = db.npcs.filter((n) => !owned.has(n.campaignId));
    db.encounters = db.encounters.filter((e) => !owned.has(e.campaignId));
    db.journal = db.journal.filter((j) => !owned.has(j.campaignId));
    db.characters = db.characters.filter((c) => c.ownerId !== userId).map((c) => (c.campaignId && owned.has(c.campaignId) ? { ...c, campaignId: null } : c));
    db.library = db.library.filter((a) => a.ownerId !== userId);
    db.customSystems = db.customSystems.filter((s) => s.ownerId !== userId);
    db.users = db.users.filter((u) => u.profile.id !== userId);
    commit();
    return respond(undefined);
  },
};
