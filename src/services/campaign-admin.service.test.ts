import { beforeEach, describe, expect, it } from "vitest";
import { resetMockDatabase } from "@/repositories/mock";
import { repositories } from "@/repositories";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { campaignAdminService, type CampaignSettings } from "./campaign-admin.service";
import { campaignService } from "./campaign.service";

const GM = { id: DEMO_USER_ID, displayName: "Rafael" };
const PLAYER = { id: "user_camila", displayName: "Camila" };
const CAMPAIGN = "c_valdrith";

async function settings(): Promise<CampaignSettings> {
  const c = (await repositories().campaigns.getById(CAMPAIGN))!;
  return { name: c.name, tagline: c.tagline, status: c.status, world: c.world, gameMaster: c.gameMaster, playerPolicy: c.playerPolicy };
}

describe("campaign administration", () => {
  beforeEach(() => resetMockDatabase());

  it("the GM edits settings and table rules; players cannot", async () => {
    const s = await settings();
    const saved = await campaignAdminService.updateSettings(CAMPAIGN, GM, { ...s, name: "  Cinzas  ", playerPolicy: { ...s.playerPolicy, allowPrivateMessages: false, maxPlayers: 6 } });
    expect(saved.name).toBe("Cinzas");
    expect(saved.playerPolicy).toMatchObject({ allowPrivateMessages: false, maxPlayers: 6 });
    await expect(campaignAdminService.updateSettings(CAMPAIGN, PLAYER, s)).rejects.toMatchObject({ code: "forbidden" });
    // Four players at the table: the limit can't go below that.
    await expect(campaignAdminService.updateSettings(CAMPAIGN, GM, { ...s, playerPolicy: { ...s.playerPolicy, maxPlayers: 3 } })).rejects.toMatchObject({ code: "validation" });
  });

  it("roles: promote a co-GM, keep at least one GM, the owner stays GM", async () => {
    await expect(campaignAdminService.setMemberRole(CAMPAIGN, GM, DEMO_USER_ID, "player")).rejects.toMatchObject({ code: "validation" });
    const promoted = await campaignAdminService.setMemberRole(CAMPAIGN, GM, "user_camila", "game_master");
    expect(promoted.members.find((m) => m.userId === "user_camila")!.role).toBe("game_master");
    // A co-GM manages players and invites, but can't change roles or remove other GMs.
    await expect(campaignAdminService.setMemberRole(CAMPAIGN, PLAYER, "user_davi", "game_master")).rejects.toMatchObject({ code: "forbidden" });
    await campaignAdminService.setMemberRole(CAMPAIGN, GM, "user_davi", "game_master");
    await expect(campaignAdminService.removeMember(CAMPAIGN, PLAYER, "user_davi")).rejects.toMatchObject({ code: "forbidden" });
    const removed = await campaignAdminService.removeMember(CAMPAIGN, PLAYER, "user_joao");
    expect(removed.members.some((m) => m.userId === "user_joao")).toBe(false);
    await expect(campaignAdminService.removeMember(CAMPAIGN, PLAYER, "user_camila")).rejects.toMatchObject({ code: "validation" });
    const back = await campaignAdminService.setMemberRole(CAMPAIGN, GM, "user_camila", "player");
    expect(back.members.find((m) => m.userId === "user_camila")!.role).toBe("player");
  });

  it("removing a player takes their character out of the campaign; the owner can't be removed", async () => {
    await expect(campaignAdminService.removeMember(CAMPAIGN, GM, DEMO_USER_ID)).rejects.toMatchObject({ code: "validation" });
    const after = await campaignAdminService.removeMember(CAMPAIGN, GM, "user_camila");
    expect(after.members.some((m) => m.userId === "user_camila")).toBe(false);
    expect((await repositories().characters.getById("ch_isolde"))!.campaignId).toBeNull();
    await expect(campaignService.getOverview(CAMPAIGN, "user_camila")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("invites respect free seats, skip pending duplicates and can be revoked", async () => {
    const s = await settings();
    await campaignAdminService.updateSettings(CAMPAIGN, GM, { ...s, playerPolicy: { ...s.playerPolicy, maxPlayers: 6 } });
    const sent = await campaignAdminService.invite(CAMPAIGN, GM, ["Nova@Mesa.com", "nova@mesa.com", "outra@mesa.com"], "Bem-vinda!");
    expect(sent.map((i) => i.email).sort()).toEqual(["nova@mesa.com", "outra@mesa.com"]);
    // 4 players + 2 pending = 6 seats: no room for more.
    await expect(campaignAdminService.invite(CAMPAIGN, GM, ["mais@mesa.com"], "")).rejects.toMatchObject({ code: "validation" });
    await expect(campaignAdminService.invite(CAMPAIGN, GM, ["não-é-email"], "")).rejects.toMatchObject({ code: "validation" });

    // Someone already at the table isn't invited (and takes no seat).
    const players = await repositories().users.getMany(["user_camila"]);
    expect(await campaignAdminService.invite(CAMPAIGN, GM, [players[0].email], "")).toEqual([]);

    const revoked = await campaignAdminService.revokeInvite(CAMPAIGN, GM, sent[0].id);
    expect(revoked.status).toBe("revoked");
    expect(await campaignService.listPendingInvites(sent[0].email)).toEqual([]);
    await expect(campaignAdminService.invite(CAMPAIGN, PLAYER, ["x@y.com"], "")).rejects.toMatchObject({ code: "forbidden" });
  }, 15_000);
});
