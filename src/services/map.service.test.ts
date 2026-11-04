import { beforeEach, describe, expect, it } from "vitest";
import { resetMockDatabase } from "@/repositories/mock";
import { DEMO_USER_ID } from "@/mocks/fixtures/seed";
import { cryptMap } from "@/features/map/model/templates";
import { mapService } from "./map.service";

const GM = { id: DEMO_USER_ID };
const PLAYER = { id: "user_camila" };
const CAMPAIGN = "c_valdrith";

describe("map library", () => {
  beforeEach(() => resetMockDatabase());

  it("saves, updates by id, copies and removes maps for the GM", async () => {
    const doc = cryptMap();
    const saved = await mapService.save(CAMPAIGN, GM, doc);
    expect(saved).toMatchObject({ id: doc.id, campaignId: CAMPAIGN, name: "Cripta esquecida", createdBy: GM.id });

    await mapService.save(CAMPAIGN, GM, { ...doc, name: "  Cripta revisitada " });
    const copy = await mapService.save(CAMPAIGN, GM, doc, { asCopy: true });
    expect(copy.id).not.toBe(doc.id);
    expect(copy.document.id).toBe(copy.id);

    const list = await mapService.list(CAMPAIGN, GM);
    expect(list.map((m) => m.name).sort()).toEqual(["Cripta esquecida (cópia)", "Cripta revisitada"]);

    await mapService.remove(CAMPAIGN, GM, doc.id);
    expect((await mapService.list(CAMPAIGN, GM)).map((m) => m.id)).toEqual([copy.id]);
  });

  it("keeps players out and rejects nameless maps", async () => {
    await expect(mapService.list(CAMPAIGN, PLAYER)).rejects.toMatchObject({ code: "forbidden" });
    await expect(mapService.save(CAMPAIGN, PLAYER, cryptMap())).rejects.toMatchObject({ code: "forbidden" });
    await expect(mapService.save(CAMPAIGN, GM, { ...cryptMap(), name: "   " })).rejects.toMatchObject({ code: "validation" });
  });
});
