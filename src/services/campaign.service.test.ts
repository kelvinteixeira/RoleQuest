import { beforeEach, describe, expect, it } from "vitest";
import { resetMockDatabase } from "@/repositories/mock";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { campaignService } from "./campaign.service";

const GM = { id: DEMO_USER_ID };
const PLAYER = { id: "user_camila" };
const CAMPAIGN = "c_valdrith";

describe("completing a session", () => {
  beforeEach(() => resetMockDatabase());

  it("the GM marks the next session as played: it moves to the history", async () => {
    const before = await campaignService.getOverview(CAMPAIGN, GM.id);
    const next = before.upcomingSessions[0];
    expect(next).toBeDefined();
    const done = await campaignService.completeSession(CAMPAIGN, next.id, GM);
    expect(done.status).toBe("completed");
    const after = await campaignService.getOverview(CAMPAIGN, GM.id);
    expect(after.upcomingSessions.some((s) => s.id === next.id)).toBe(false);
    expect(after.pastSessions[0]?.id).toBe(next.id);
    expect(after.pastSessions).toHaveLength(before.pastSessions.length + 1);
  });

  it("players can't, and a session of another campaign is not found", async () => {
    const { upcomingSessions } = await campaignService.getOverview(CAMPAIGN, GM.id);
    await expect(campaignService.completeSession(CAMPAIGN, upcomingSessions[0].id, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(campaignService.completeSession(CAMPAIGN, "s_other_1", GM)).rejects.toMatchObject({ code: "not_found" });
  });
});
