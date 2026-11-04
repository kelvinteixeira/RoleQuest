import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/combat/model/rules";
import type { CombatRules } from "@/features/combat/model/types";
import { createBlankMap } from "@/features/map/model/map-document";
import type { ChatMessage } from "@/features/virtual-tabletop/model/types";
import { roll } from "@/features/dice/dice-engine";
import { scriptedRng } from "@/test/rng";
import type { Npc } from "@/types/gm";
import { encounterDifficulty, encounterTokens, threat } from "./encounter";
import { generateHook, generateName, generateNpc, generateTreasure, settingFor } from "./generators";
import { groupBySession, journalFromMessages } from "./journal";
import { npcToken, playerView, validateNpc } from "./npc";

const npc = (patch: Partial<Npc> = {}): Npc => ({
  id: "n1",
  campaignId: "c1",
  name: "Mira",
  concept: "Taverneira",
  attitude: "neutral",
  portraitColor: "#888",
  location: "Taverna",
  description: "Ouve tudo.",
  secretNotes: "Trai o grupo.",
  facts: [
    { id: "a", text: "Guarda um mapa.", revealed: true },
    { id: "b", text: "Recebe cartas Vex.", revealed: false },
  ],
  stats: { hp: 11, defense: 12, attackBonus: 3, damage: "1d6+1", speed: 6, initiativeBonus: 1 },
  known: true,
  createdAt: "",
  updatedAt: "",
  ...patch,
});

describe("NPC player view", () => {
  it("shows only revealed facts and never secrets or stats", () => {
    const view = playerView(npc())!;
    expect(view.facts).toEqual([{ id: "a", text: "Guarda um mapa." }]);
    expect(JSON.stringify(view)).not.toContain("Trai o grupo");
    expect(view).not.toHaveProperty("stats");
  });

  it("hides unknown NPCs entirely", () => {
    expect(playerView(npc({ known: false }))).toBeNull();
  });

  it("validates name and stats", () => {
    expect(validateNpc({ name: " ", stats: npc().stats })).toHaveProperty("name");
    expect(validateNpc({ name: "Ok", stats: { ...npc().stats, hp: 0 } })).toHaveProperty("hp");
    expect(validateNpc(npc())).toEqual({});
  });
});

describe("NPC tokens", () => {
  it("hostile NPCs join the enemies; stats follow the room's system", () => {
    const coc: CombatRules = { systemId: "call-of-cthulhu", mechanic: "d100-roll-under", primaryDie: "d100", defenseLabel: "Esquivar" };
    const t = npcToken(npc({ attitude: "hostile", concept: "Esqueleto" }), coc, { x: 2, y: 3 });
    expect(t).toMatchObject({ kind: "enemy", x: 2, y: 3, modelId: "skeleton-warrior", npc: { hp: 11 } });
    expect(t.hp.max).toBeLessThan(11);
    expect(npcToken(npc(), DEFAULT_RULES, { x: 0, y: 0 }).kind).toBe("npc");
  });
});

describe("encounters", () => {
  const raider = npc({ id: "r", attitude: "hostile" });
  const boss = npc({ id: "b", attitude: "hostile", stats: { hp: 70, defense: 16, attackBonus: 8, damage: "2d8+4", speed: 6, initiativeBonus: 3 } });

  it("allies in an encounter don't make it harder", () => {
    const ally = npc({ id: "a", attitude: "ally", stats: boss.stats });
    const alone = encounterDifficulty({ entries: [{ npcId: "r", count: 3 }] }, [raider, ally], 4, 1);
    const withAlly = encounterDifficulty({ entries: [{ npcId: "r", count: 3 }, { npcId: "a", count: 1 }] }, [raider, ally], 4, 1);
    expect(withAlly).toEqual(alone);
  });

  it("rates difficulty against the party", () => {
    expect(threat(boss.stats)).toBeGreaterThan(threat(raider.stats) * 3);
    expect(encounterDifficulty({ entries: [{ npcId: "r", count: 1 }] }, [raider], 4, 3).difficulty).toBe("trivial");
    expect(encounterDifficulty({ entries: [{ npcId: "r", count: 3 }] }, [raider], 4, 1).difficulty).toBe("medium");
    expect(encounterDifficulty({ entries: [{ npcId: "b", count: 2 }, { npcId: "r", count: 6 }] }, [raider, boss], 4, 1).difficulty).toBe("deadly");
    // Entries for NPCs that no longer exist count for nothing.
    expect(encounterDifficulty({ entries: [{ npcId: "gone", count: 5 }] }, [raider], 4, 1).threat).toBe(0);
  });

  it("places numbered tokens on free squares away from the party", () => {
    const map = createBlankMap(20, 10);
    const hero = { ...npcToken(npc({ attitude: "ally" }), DEFAULT_RULES, { x: 2, y: 5 }), kind: "pc" as const };
    const tokens = encounterTokens({ entries: [{ npcId: "r", count: 3 }] }, [raider], map, DEFAULT_RULES, [hero]);
    expect(tokens.map((t) => t.name)).toEqual(["Mira 1", "Mira 2", "Mira 3"]);
    expect(new Set(tokens.map((t) => `${t.x},${t.y}`)).size).toBe(3);
    expect(Math.min(...tokens.map((t) => t.x))).toBeGreaterThan(10);
  });
});

describe("journal from the table", () => {
  const author = { id: "a", name: "Isolde", color: "#fff" };
  const msg = (id: string, partial: Partial<ChatMessage>): ChatMessage => ({ id, at: `2026-11-04T20:0${id}:00Z`, kind: "system", author, text: "", visibility: "public", ...partial });

  it("keeps combats, falls, traps, reveals, places, epic moments and natural 20s/1s", () => {
    const messages = [
      msg("1", { text: "Combate! Iniciativa: Isolde 18 · Esqueleto 9" }),
      msg("2", { kind: "roll", text: "Ataque em Esqueleto", roll: roll("1d20", "normal", scriptedRng(20)) }),
      msg("3", { kind: "roll", text: "Ataque em Isolde", roll: roll("1d20", "normal", scriptedRng(12)) }),
      msg("4", { text: "Esqueleto está fora de combate." }),
      msg("5", { text: "Vitória! O grupo venceu o combate." }),
      msg("6", { kind: "chat", text: "boa!" }),
      msg("7", { kind: "epic", text: "Isolde salvou o refém." }),
      msg("8", { text: "Isolde ativou: armadilha de espinhos!" }),
      msg("9", { kind: "roll", text: "Rolagem secreta", roll: roll("1d20", "normal", scriptedRng(1)), visibility: "gm" }),
    ];
    const entries = journalFromMessages(messages, "c1", "Sessão 7", new Set(["5"]));
    expect(entries.map((e) => [e.kind, e.sourceId])).toEqual([
      ["combat", "1"],
      ["critical", "2"],
      ["down", "4"],
      ["epic", "7"],
      ["trap", "8"],
    ]);
    expect(entries[1].text).toBe("Isolde tirou 20 natural: Ataque em Esqueleto.");
    expect(entries[0].text).toBe("Começou um combate: Isolde, Esqueleto.");
  });

  it("groups by session in time order", () => {
    const groups = groupBySession([
      { sessionLabel: "S2", at: "2026-02-01" },
      { sessionLabel: "S1", at: "2026-01-02" },
      { sessionLabel: "S1", at: "2026-01-01" },
    ]);
    expect(groups.map((g) => [g.session, g.entries.length])).toEqual([
      ["S1", 2],
      ["S2", 1],
    ]);
  });
});

describe("generators", () => {
  it("are deterministic per seed and follow the setting", () => {
    expect(generateName("fantasy", 7)).toBe(generateName("fantasy", 7));
    expect(generateNpc("c1", "horror", 3)).toEqual(generateNpc("c1", "horror", 3));
    expect(generateNpc("c1", "modern", 3, { threat: "boss" }).stats.hp).toBe(70);
    expect(generateTreasure("fantasy", 9, 3)).toHaveLength(3);
    expect(generateHook("modern", 1).length).toBeGreaterThan(10);
  });

  it("pick the setting from the system genres", () => {
    expect(settingFor(["Cyberpunk", "Ação"])).toBe("modern");
    expect(settingFor(["Horror", "Investigação"])).toBe("horror");
    expect(settingFor(["Fantasia", "Aventura"])).toBe("fantasy");
    expect(settingFor(["Genérico"])).toBe("fantasy");
  });
});
