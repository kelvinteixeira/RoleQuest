import { describe, expect, it } from "vitest";
import { createSheet } from "@/features/character-sheet/model/sheet";
import { resolveCheck } from "@/features/character-sheet/model/checks";
import { combatProfile } from "@/features/combat/model/profile";
import { BUILT_IN_SYSTEMS, getBuiltInSystem } from "@/features/systems/templates";
import { duplicateAsCustom, newClass } from "@/features/systems/model/system-editor";
import type { CharacterSheet } from "@/types/character";
import type { SystemTemplate } from "@/types/system";
import { MODULES, rulesFor, syncSheet } from "./rules/registry";
import { rulesUiFor } from "./rules/ui";
import { genericRules } from "./rules/generic";
import { halfLevel, t20Rules } from "./tormenta20/rules";
import { nexLevel } from "./ordem-paranormal/rules";
import { pf2Build, pf2Rules } from "./pathfinder2e/rules";
import { applySheetRanks } from "./pathfinder2e/ranks";
import { cocBuild, cocMove } from "./call-of-cthulhu/rules";
import { cyberBuild } from "./cyberpunk-red/rules";
import { storytellerBuild } from "./storyteller/rules";
import { attributeCost, gurpsBuild, pointsSpent } from "./gurps/rules";

const sys = (id: string) => getBuiltInSystem(id as never)!;
const withAttrs = (system: SystemTemplate, attrs: Record<string, number>): CharacterSheet => ({ ...createSheet(system), attributes: { ...createSheet(system).attributes, ...attrs } });
const fixed = (n: number) => () => n;

describe("every built-in system has a rules module, a sheet panel and a guided creation", () => {
  it("covers all ten", () => {
    for (const s of BUILT_IN_SYSTEMS) {
      expect(rulesFor(s), s.id).not.toBe(genericRules);
      expect(rulesUiFor(s).Panel, s.id).toBeDefined();
      expect(rulesUiFor(s).creation, s.id).toBeDefined();
    }
    expect(new Set(MODULES.map((m) => m.systemId)).size).toBe(MODULES.length);
  });

  it("each guided creation builds a full sheet from its starting state", () => {
    for (const s of BUILT_IN_SYSTEMS) {
      const flow = rulesUiFor(s).creation!;
      const { sheet } = flow.build(s, flow.initial(s), 1);
      for (const r of s.resources) expect(sheet.resources[r.key], `${s.id}.${r.key}`).toBeDefined();
      // Synced already: building twice changes nothing.
      expect(syncSheet(s, sheet, 1), s.id).toEqual(sheet);
    }
  });
});

describe("Tormenta20", () => {
  const t20 = sys("tormenta20");
  it("skills add half the level and, trained, 2/4/6; attribute tests don't", () => {
    const sheet = withAttrs(t20, { des: 3 });
    sheet.skills.reflexos = { trained: true, bonus: 0 };
    expect(halfLevel(9)).toBe(4);
    // 1d20 + DES 3 + half level 4 + training 4 (level 9).
    expect(resolveCheck(t20, sheet, 9, { skillKey: "reflexos" }, fixed(10)).result.total).toBe(10 + 3 + 4 + 4);
    expect(resolveCheck(t20, sheet, 9, { attributeKey: "des" }, fixed(10)).result.total).toBe(13);
    expect(t20Rules.saves!(t20, sheet, 9).map((s) => s.key)).toEqual(["fortitude", "reflexos", "vontade"]);
  });
  it("Defesa = 10 + DES + bonus, on the token too", () => {
    expect(combatProfile(t20, withAttrs(t20, { des: 2 }), 1).defense).toBe(12);
  });
});

describe("Ordem Paranormal", () => {
  const op = sys("ordem-paranormal");
  it("NEX → exposure level; class resources grow per 5% of NEX", () => {
    expect([5, 10, 50, 95, 99].map(nexLevel)).toEqual([1, 2, 10, 19, 20]);
    const copy: SystemTemplate = { ...duplicateAsCustom(op), classes: [{ ...newClass("Combatente", []), resourceBonus: { pv: 20 }, resourceGrowth: { pv: { perLevel: 4, attributeKey: "vig" } } }] };
    const sheet = { ...withAttrs(copy, { vig: 2 }), classKey: copy.classes![0].key };
    // NEX 15% = level 3: 20 + 4 × 2 + VIG 2 × 3.
    expect(syncSheet(copy, sheet, 15).resources.pv.max).toBe(20 + 8 + 6);
  });
  it("skills roll their own attribute's dice", () => {
    const sheet = withAttrs(op, { int: 3, agi: 1 });
    sheet.skills.investigacao = { trained: true, bonus: 5 };
    const r = resolveCheck(op, sheet, 5, { skillKey: "investigacao" }, fixed(12));
    expect(r.result.dice).toHaveLength(3);
    expect(r.result.total).toBe(17);
  });
});

describe("Pathfinder 2e", () => {
  const pf2 = sys("pathfinder2e");
  it("ranks: trained level + 2, each rank above adds 2; saves, Perception and AC use them", () => {
    let sheet = pf2Build.write(withAttrs(pf2, { dex: 3, con: 2, wis: 1 }), { ancestryHp: 8, classHp: 10, dexCap: 2, itemAc: 1, ranks: { perception: 2, fort: 2, ref: 1, will: 1, ac: 1 } });
    sheet = applySheetRanks(sheet, { furtividade: 3 });
    // Master Stealth at 5: DEX 3 + 5 + 6.
    expect(resolveCheck(pf2, sheet, 5, { skillKey: "furtividade" }, fixed(10)).result.total).toBe(10 + 3 + 5 + 6);
    expect(resolveCheck(pf2, sheet, 5, { attributeKey: "con", save: true, saveKey: "fort", label: "Fortitude" }, fixed(10))).toMatchObject({ label: "Fortitude", result: { total: 10 + 2 + 9 } });
    // AC: 10 + DEX capped at 2 + trained 7 + item 1.
    expect(pf2Rules.defense!(pf2, sheet, 5)).toBe(20);
    expect(combatProfile(pf2, sheet, 5).initiative).toBe(1 + 9);
    // HP: 8 + (10 + 2) × 5.
    expect(syncSheet(pf2, sheet, 5).resources.hp.max).toBe(68);
  });
});

describe("3D&T Victory", () => {
  it("PV and PM = R × 5, PA = P", () => {
    const s = sys("3dt-victory");
    const sheet = syncSheet(s, withAttrs(s, { poder: 2, resistencia: 3 }), 1);
    expect([sheet.resources.pv.max, sheet.resources.pm.max, sheet.resources.pa.max]).toEqual([15, 15, 2]);
  });
});

describe("Call of Cthulhu", () => {
  const coc = sys("call-of-cthulhu");
  it("HP, MP, move, damage bonus and build", () => {
    const sheet = withAttrs(coc, { str: 70, con: 60, siz: 65, dex: 50, pow: 55 });
    const synced = syncSheet(coc, sheet, null);
    expect([synced.resources.hp.max, synced.resources.mp.max]).toEqual([12, 11]);
    expect(cocMove(coc, sheet)).toBe(8);
    expect(cocBuild(coc, sheet)).toEqual({ damage: "+1D4", build: 1 });
    expect(cocBuild(coc, withAttrs(coc, { str: 40, siz: 40 }))).toEqual({ damage: "−1", build: -1 });
    expect(cocBuild(coc, withAttrs(coc, { str: 50, siz: 50 }))).toEqual({ damage: "0", build: 0 });
  });
  it("the guide spends occupation and interest points on top of the base", () => {
    const flow = rulesUiFor(coc).creation!;
    const state = { ...flow.initial(coc), method: "points", scores: { str: 50, con: 50, siz: 50, dex: 60, app: 50, int: 70, pow: 60, edu: 80 } };
    expect(flow.problem(1, { ...state, skills: { biblioteca: 90, encontrar: 90, escutar: 90, psicologia: 90, medicina: 90 } }, coc)).toBeNull();
    expect(flow.problem(1, { ...state, skills: Object.fromEntries(coc.skills.map((k) => [k.key, 90])) }, coc)).toBe("Pontos acima do limite.");
    const { sheet } = flow.build(coc, state, 1);
    expect(sheet.skills.esquivar.bonus).toBe(30);
    expect(sheet.resources.san).toEqual({ current: 60, max: 99 });
  });
});

describe("Cyberpunk RED", () => {
  it("HP from BODY and WILL; cyberware lowers Humanity", () => {
    const s = sys("cyberpunk-red");
    const sheet = cyberBuild.write(withAttrs(s, { body: 7, will: 6, emp: 6, luck: 4 }), { cyberware: [{ id: "a", name: "Braço", loss: 7 }] });
    const synced = syncSheet(s, sheet, null);
    expect(synced.resources.hp.max).toBe(10 + 5 * 7);
    expect(synced.resources.humanity.max).toBe(53);
    expect(synced.resources.luck.max).toBe(4);
  });
});

describe("Vampiro and Lobisomem", () => {
  it("tracks follow Stamina and Composure + Resolve; marked damage sets the current value", () => {
    const v = sys("vampire-masquerade");
    const plain = syncSheet(v, withAttrs(v, { stamina: 3, composure: 2, resolve: 3 }), null);
    expect([plain.resources.health.max, plain.resources.willpower.max]).toEqual([6, 5]);
    const hurt = storytellerBuild("vampire-masquerade").write(plain, { damage: { health: { superficial: 2, aggravated: 1 }, willpower: { superficial: 9, aggravated: 0 } } });
    const synced = syncSheet(v, hurt, null);
    expect(synced.resources.health.current).toBe(3);
    expect(synced.resources.willpower.current).toBe(0);
  });
  it("the guide places 4/3/3/3/2/2/2/2/1 and a skill spread; fledglings start at Humanity 7, Hunger 1", () => {
    const v = sys("vampire-masquerade");
    const flow = rulesUiFor(v).creation!;
    const pool = [4, 3, 3, 3, 2, 2, 2, 2, 1];
    const scores = Object.fromEntries(v.attributes.map((a, i) => [a.key, pool[i]]));
    const spec = [4, 3, 3, 3, 2, 2, 2, 1, 1, 1];
    const skills = Object.fromEntries(v.skills.slice(0, spec.length).map((k, i) => [k.key, spec[i]]));
    const state = { ...flow.initial(v), scores, profile: "specialist", skills };
    expect(flow.problem(1, state, v)).toBeNull();
    expect(flow.problem(2, state, v)).toBeNull();
    const { sheet } = flow.build(v, state, 1);
    expect(sheet.resources.humanity.current).toBe(7);
    expect(sheet.resources.hunger.current).toBe(1);
    expect(sheet.skills[v.skills[0].key].bonus).toBe(4);
  });
});

describe("GURPS", () => {
  it("attribute costs, extras and the point total", () => {
    const g = sys("gurps");
    expect(attributeCost("dx", 12, {})).toBe(40);
    expect(attributeCost("will", 13, { iq: 12 })).toBe(5);
    const sheet = gurpsBuild.write(withAttrs(g, { st: 11, dx: 12, iq: 12, ht: 10, will: 12, per: 12 }), { extraHp: 2, traits: [{ id: "t", name: "Reflexos em combate", cost: 15 }, { id: "d", name: "Teimosia", cost: -5 }], skillPoints: 20 });
    expect(pointsSpent(g, sheet)).toEqual({ attributes: 10 + 40 + 40, traits: 10, skills: 20, extras: 4, total: 124 });
    expect(syncSheet(g, sheet, null).resources.hp.max).toBe(13);
  });
});
