import { beforeEach, describe, expect, it } from "vitest";
import { resetMockDatabase } from "@/repositories/mock";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { demoScript } from "@/features/chronicles/model/demo-script";
import { normalizeScript } from "@/features/chronicles/model/script";
import { chroniclesService } from "./chronicles.service";

const GM = { id: DEMO_USER_ID };
const PLAYER = { id: "user_camila" };
const OUTSIDER = { id: "user_nobody" };
const CAMPAIGN = "c_valdrith";

let n = 0;
const script = () =>
  normalizeScript(
    demoScript({ campaign: { name: "Valdrith", tagline: "", world: { name: "Valdrith", tone: [] } }, characters: [] }, [{ id: "m1", at: "2026-01-01", sessionLabel: "Sessão 1", kind: "epic", text: "A ponte caiu.", score: 9, private: false }]),
    () => `sc${++n}`,
  );

describe("Chronicles sharing", () => {
  beforeEach(() => resetMockDatabase());

  it("players see only the episodes the GM shared, and stop seeing them when unshared", async () => {
    const episode = await chroniclesService.createEpisode(CAMPAIGN, GM, ["m1"], script());
    expect(episode).toMatchObject({ publishedAt: null, voices: {} });
    expect((await chroniclesService.loadShared(CAMPAIGN, PLAYER)).episodes).toEqual([]);

    const shared = await chroniclesService.setShared(episode, GM, true);
    expect(shared.publishedAt).not.toBeNull();
    const seen = await chroniclesService.loadShared(CAMPAIGN, PLAYER);
    expect(seen.episodes.map((e) => e.id)).toEqual([episode.id]);
    expect(seen.overview.role).toBe("player");

    await chroniclesService.setShared(shared, GM, false);
    expect((await chroniclesService.loadShared(CAMPAIGN, PLAYER)).episodes).toEqual([]);
  });

  it("only GMs share; outsiders see nothing; the demo account sees Lia's shared episode as a player", async () => {
    const episode = await chroniclesService.createEpisode(CAMPAIGN, GM, [], script());
    await expect(chroniclesService.setShared(episode, PLAYER, true)).rejects.toMatchObject({ code: "forbidden" });
    await expect(chroniclesService.loadShared(CAMPAIGN, OUTSIDER)).rejects.toBeTruthy();
    const lamina = await chroniclesService.loadShared("c_lamina", GM);
    expect(lamina.overview.role).toBe("player");
    expect(lamina.episodes.map((e) => e.title)).toEqual(["Nível -3"]);
  });
});
