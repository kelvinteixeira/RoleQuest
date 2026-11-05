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

  it("removing a player takes their character out of the campaign and renews the link; the owner can't be removed", async () => {
    await expect(campaignAdminService.removeMember(CAMPAIGN, GM, DEMO_USER_ID)).rejects.toMatchObject({ code: "validation" });
    const before = (await campaignAdminService.inviteLink(CAMPAIGN, GM))!;
    const after = await campaignAdminService.removeMember(CAMPAIGN, GM, "user_camila");
    const renewed = (await campaignAdminService.inviteLink(CAMPAIGN, GM))!;
    expect(renewed.code).not.toBe(before.code);
    await expect(campaignService.joinWithInvite(before.code, { id: "user_camila" })).rejects.toMatchObject({ code: "not_found" });
    expect(after.members.some((m) => m.userId === "user_camila")).toBe(false);
    expect((await repositories().characters.getById("ch_isolde"))!.campaignId).toBeNull();
    await expect(campaignService.getOverview(CAMPAIGN, "user_camila")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("invite links: only GMs manage them; whoever opens one joins while there are seats; a new code kills the old link", async () => {
    await expect(campaignAdminService.renewInviteLink(CAMPAIGN, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(campaignAdminService.inviteLink(CAMPAIGN, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    const link = await campaignAdminService.renewInviteLink(CAMPAIGN, GM);
    expect(await campaignAdminService.inviteLink(CAMPAIGN, GM)).toEqual(link);

    // Four players, four seats: the link opens but nobody can join.
    const s = await settings();
    await campaignAdminService.updateSettings(CAMPAIGN, GM, { ...s, playerPolicy: { ...s.playerPolicy, maxPlayers: 4 } });
    const pasted = `https://mesa.exemplo/join/${link.code}`;
    const { preview } = await campaignService.previewInvite(pasted, { id: "user_bruno" });
    expect(preview).toMatchObject({ campaignId: CAMPAIGN, freeSeats: 0, alreadyMember: false });
    await expect(campaignService.joinWithInvite(pasted, { id: "user_bruno" })).rejects.toMatchObject({ code: "validation" });

    await campaignAdminService.updateSettings(CAMPAIGN, GM, { ...s, playerPolicy: { ...s.playerPolicy, maxPlayers: 5 } });
    expect(await campaignService.joinWithInvite(link.code, { id: "user_bruno" })).toBe(CAMPAIGN);
    expect((await repositories().campaigns.getById(CAMPAIGN))!.members.find((m) => m.userId === "user_bruno")?.role).toBe("player");
    // Opening it again is harmless.
    expect(await campaignService.joinWithInvite(link.code, { id: "user_bruno" })).toBe(CAMPAIGN);

    // A new code: the shared link stops working. Turned off: no link at all.
    const renewed = await campaignAdminService.renewInviteLink(CAMPAIGN, GM);
    expect(renewed.code).not.toBe(link.code);
    await expect(campaignService.previewInvite(link.code, { id: "user_lia" })).rejects.toMatchObject({ code: "not_found" });
    await campaignAdminService.disableInviteLink(CAMPAIGN, GM);
    expect(await campaignAdminService.inviteLink(CAMPAIGN, GM)).toBeNull();
    await expect(campaignService.joinWithInvite(renewed.code, { id: "user_lia" })).rejects.toMatchObject({ code: "not_found" });
    await expect(campaignService.joinWithInvite("isto não é um link", { id: "user_lia" })).rejects.toMatchObject({ code: "validation" });
  }, 15_000);
});
