import { beforeEach, describe, expect, it } from "vitest";
import { resetMockDatabase } from "@/repositories/mock";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { gmService } from "./gm.service";

const GM = { id: DEMO_USER_ID };
const PLAYER = { id: "user_camila" };
const OUTSIDER = { id: "user_nobody" };
const CAMPAIGN = "c_valdrith";

describe("GM tools service", () => {
  beforeEach(() => resetMockDatabase());

  it("players only learn what the GM reveals", async () => {
    const before = await gmService.knownNpcs(CAMPAIGN, PLAYER);
    expect(before.map((n) => n.name).sort()).toEqual(["Lorde Aldren Vex", "Mira Fumaça"]);
    expect(before.find((n) => n.name === "Mira Fumaça")!.facts).toHaveLength(1);
    expect(JSON.stringify(before)).not.toContain("Contrabandeia");

    // Revealing a fact of an unknown NPC makes it known.
    await gmService.setFactRevealed(CAMPAIGN, GM, "npc_raider", "f_raider_1", true);
    const after = await gmService.knownNpcs(CAMPAIGN, PLAYER);
    expect(after.find((n) => n.id === "npc_raider")!.facts.map((f) => f.text)).toEqual(["Todos têm a mesma tatuagem de corvo no pulso."]);
  });

  it("keeps NPCs, encounters and private notes away from players and outsiders", async () => {
    await expect(gmService.listNpcs(CAMPAIGN, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(gmService.createNpc(CAMPAIGN, PLAYER, { name: "X" } as never)).rejects.toMatchObject({ code: "forbidden" });
    await expect(gmService.listEncounters(CAMPAIGN, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(gmService.knownNpcs(CAMPAIGN, OUTSIDER)).rejects.toMatchObject({ code: "forbidden" });

    const gm = await gmService.listJournal(CAMPAIGN, GM);
    const player = await gmService.listJournal(CAMPAIGN, PLAYER);
    expect(gm.entries.length).toBe(player.entries.length + 1);
    expect(player.entries.some((e) => e.private)).toBe(false);
  });

  it("encounters keep only this campaign's NPCs with sane counts; removing an NPC drops it from encounters", async () => {
    const saved = await gmService.saveEncounter(CAMPAIGN, GM, { name: " Ponte ", description: "", entries: [{ npcId: "npc_raider", count: 99 }, { npcId: "ghost", count: 2 }] });
    expect(saved).toMatchObject({ name: "Ponte", entries: [{ npcId: "npc_raider", count: 20 }] });
    await gmService.removeNpc(CAMPAIGN, GM, "npc_raider");
    const list = await gmService.listEncounters(CAMPAIGN, GM);
    expect(list.every((e) => e.entries.length === 0)).toBe(true);
  });

  it("an entry from the table removed by the GM never comes back", async () => {
    const entry = { campaignId: CAMPAIGN, at: "2026-11-04T20:00:00Z", sessionLabel: "Sessão 7", kind: "critical" as const, text: "1 natural", private: false, sourceId: "msg_9" };
    const [added] = await gmService.record(CAMPAIGN, GM, [entry]);
    await gmService.removeEntry(CAMPAIGN, GM, added.id);
    const after = await gmService.listJournal(CAMPAIGN, GM);
    expect(after.entries.some((e) => e.id === added.id)).toBe(false);
    expect(after.recordedSources).toContain("msg_9");
    expect(await gmService.record(CAMPAIGN, GM, [entry])).toHaveLength(0);
    // Players never see the marker.
    expect((await gmService.listJournal(CAMPAIGN, PLAYER)).recordedSources).toEqual([]);
  });

  it("merges repeated creatures and ignores broken counts", async () => {
    const saved = await gmService.saveEncounter(CAMPAIGN, GM, { name: "Dobro", description: "", entries: [{ npcId: "npc_raider", count: 2 }, { npcId: "npc_raider", count: Number.NaN }] });
    expect(saved.entries).toEqual([{ npcId: "npc_raider", count: 3 }]);
  });

  it("rejects NPCs with an invalid damage formula", async () => {
    const vex = (await gmService.listNpcs(CAMPAIGN, GM)).find((n) => n.id === "npc_vex")!;
    await expect(gmService.updateNpc(CAMPAIGN, GM, vex.id, { stats: { ...vex.stats, damage: "abc" } })).rejects.toMatchObject({ code: "validation" });
  });

  it("records table entries once", async () => {
    const entry = { campaignId: CAMPAIGN, at: "2026-11-04T20:00:00Z", sessionLabel: "Sessão 7", kind: "epic" as const, text: "Algo épico", private: false, sourceId: "msg_1" };
    expect(await gmService.record(CAMPAIGN, GM, [entry])).toHaveLength(1);
    expect(await gmService.record(CAMPAIGN, GM, [entry])).toHaveLength(0);
    await expect(gmService.addNote(CAMPAIGN, GM, { text: "  ", sessionLabel: "x", private: true })).rejects.toMatchObject({ code: "validation" });
  });
});
