import { describe, expect, it } from "vitest";
import type { JournalEntry } from "@/types/gm";
import { demoScript } from "./demo-script";
import { dramaScore, momentsFromJournal, pickHighlights } from "./moments";
import { castOf, portraitPrompt, scenePrompt } from "./prompts";
import { GeneratedScriptSchema, normalizeScript, SCENE_LIMIT, type GeneratedScript } from "./script";

const entry = (id: string, kind: JournalEntry["kind"], text: string, at: string, sessionLabel = "Sessão 1", extra: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  campaignId: "c1",
  at,
  sessionLabel,
  kind,
  text,
  private: false,
  dismissed: false,
  createdAt: at,
  updatedAt: at,
  ...extra,
});

describe("the campaign's best moments", () => {
  it("score drama: epic beats crits, a natural 20 beats a 1, a fallen hero beats a fallen goblin, victories count", () => {
    expect(dramaScore("epic", "Kira roubou a joia")).toBe(10);
    expect(dramaScore("critical", "Isolde tirou 20 natural: Ataque em Esqueleto.")).toBeGreaterThan(dramaScore("critical", "Grom tirou 1 natural: Furtividade."));
    expect(dramaScore("down", "Isolde caiu!")).toBeGreaterThan(dramaScore("down", "Esqueleto está fora de combate."));
    expect(dramaScore("combat", "Vitória! O grupo venceu o combate.")).toBeGreaterThan(dramaScore("combat", "Começou um combate: Isolde."));
  });

  it("dismissed journal entries stay out; moments come in story order", () => {
    const moments = momentsFromJournal([
      entry("b", "trap", "Grom ativou: armadilha!", "2026-11-02T10:00:00Z"),
      entry("a", "epic", "A ponte caiu", "2026-11-01T10:00:00Z"),
      entry("x", "note", "descartado", "2026-11-01T11:00:00Z", "Sessão 1", { dismissed: true }),
    ]);
    expect(moments.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("highlights: the top moments, at least one per session, back in story order", () => {
    const moments = momentsFromJournal([
      entry("1", "map", "O grupo chegou a: Vila", "2026-11-01T10:00:00Z", "Sessão 1"),
      entry("2", "epic", "Momento épico 1", "2026-11-08T10:00:00Z", "Sessão 2"),
      entry("3", "epic", "Momento épico 2", "2026-11-08T11:00:00Z", "Sessão 2"),
      entry("4", "critical", "Isolde tirou 20 natural: Ataque em Ogro.", "2026-11-08T12:00:00Z", "Sessão 2"),
    ]);
    const picked = pickHighlights(moments, 3);
    // The natural 20 on an attack ties with the epic moments; later ones win ties.
    expect(picked.map((m) => m.id)).toEqual(["1", "3", "4"]);
    expect(pickHighlights(moments, 10)).toHaveLength(4);
  });
});

const generated: GeneratedScript = {
  title: "  A Ponte de Cinzas  ",
  logline: "O grupo cruza o abismo.",
  visualStyle: "dark fantasy comic art",
  characters: [{ name: "Isolde", look: "tall paladin, silver armor, red cape" }, { name: "Grom", look: "stout dwarf, braided beard, axe" }],
  scenes: [
    { kind: "end", narration: "Continua…", dialogue: [], imagePrompt: "sunset", cast: [], camera: "pull-out", mood: "calm", sfx: "", seconds: 4, roll: null },
    { kind: "scene", narration: "A ponte range.", dialogue: [{ speaker: "Grom", line: "Corre!" }], imagePrompt: "a rope bridge", cast: ["Grom", "isolde"], camera: "pan-left", mood: "tense", sfx: "CRACK!", seconds: 42, roll: null },
    { kind: "title", narration: "", dialogue: [], imagePrompt: "abyss", cast: [], camera: "push-in", mood: "epic", sfx: "", seconds: 1, roll: null },
    { kind: "roll", narration: "", dialogue: [], imagePrompt: "a d20", cast: ["Isolde"], camera: "still", mood: "epic", sfx: "", seconds: 5, roll: { label: "Ataque", total: 27, natural: 20 } },
  ],
};

describe("the episode script", () => {
  it("validates against the schema the AI must follow", () => {
    expect(GeneratedScriptSchema.safeParse(generated).success).toBe(true);
    expect(GeneratedScriptSchema.safeParse({ ...generated, scenes: [{ ...generated.scenes[0], camera: "drone" }] }).success).toBe(false);
  });

  it("normalizes: ids, title first and end last, durations 3–9 s, trimmed text, scene limit", () => {
    let n = 0;
    const script = normalizeScript(generated, () => `s${++n}`);
    expect(script.title).toBe("A Ponte de Cinzas");
    expect(script.scenes.map((s) => s.kind)).toEqual(["title", "scene", "roll", "end"]);
    expect(script.scenes.map((s) => s.seconds)).toEqual([3, 9, 5, 4]);
    expect(new Set(script.scenes.map((s) => s.id)).size).toBe(4);
    const many = normalizeScript({ ...generated, scenes: Array.from({ length: 30 }, () => generated.scenes[1]) }, () => `s${++n}`);
    expect(many.scenes.length).toBeLessThanOrEqual(SCENE_LIMIT);
  });

  it("image prompts carry the art direction and the looks of who is on the panel, never text", () => {
    const script = normalizeScript(generated, () => "id");
    const scene = script.scenes.find((s) => s.kind === "scene")!;
    const prompt = scenePrompt(script, scene);
    expect(prompt).toContain("dark fantasy comic art");
    expect(prompt).toContain("stout dwarf");
    expect(prompt).toContain("silver armor"); // "isolde" matches "Isolde"
    expect(prompt).toMatch(/No text/);
    expect(castOf(script, scene).map((c) => c.name)).toEqual(["Isolde", "Grom"]);
    expect(portraitPrompt(script, script.characters[0])).toContain("reference portrait of Isolde");
  });

  it("without a script AI, a rule-written episode: title, one scene per moment, dice moments as rolls, an end", () => {
    const moments = momentsFromJournal([
      entry("1", "critical", "Isolde tirou 20 natural: Ataque em Ogro.", "2026-11-01T10:00:00Z"),
      entry("2", "down", "Grom caiu!", "2026-11-01T11:00:00Z"),
    ]);
    const script = demoScript({ campaign: { name: "Cinzas", tagline: "", world: { name: "Valdrith", tone: [] } }, characters: [{ name: "Isolde", concept: "Paladina" }, { name: "Grom", concept: "Anão" }] }, moments);
    expect(GeneratedScriptSchema.safeParse(script).success).toBe(true);
    expect(script.scenes.map((s) => s.kind)).toEqual(["title", "roll", "scene", "end"]);
    expect(script.scenes[1].roll).toMatchObject({ natural: 20 });
    expect(script.scenes[2].cast).toEqual(["Grom"]);
  });
});

describe("privacy of the GM's notes", () => {
  it("GM-only journal entries are never chosen by default (they can still be picked by hand)", () => {
    const moments = momentsFromJournal([
      entry("pub", "epic", "A ponte caiu", "2026-11-01T10:00:00Z"),
      entry("sec", "note", "O rei é o vilão", "2026-11-01T11:00:00Z", "Sessão 1", { private: true }),
    ]);
    expect(moments.find((m) => m.id === "sec")?.private).toBe(true);
    expect(pickHighlights(moments).map((m) => m.id)).toEqual(["pub"]);
  });

  it("initiative lines (which name hidden creatures) go to the journal as GM-only entries", async () => {
    const { journalFromMessages } = await import("@/features/gm/model/journal");
    const msg = (id: string, text: string, visibility: "public" | "gm") => ({ id, at: "2026-11-01T10:00:00Z", kind: "system" as const, author: { id: "system", name: "Mesa", color: "#fff" }, text, visibility });
    const entries = journalFromMessages([msg("a", "Combate! Iniciativa: Isolde 18 · Assassino 9", "gm"), msg("b", "Isolde caiu!", "public")], "c1", "Sessão 1", new Set());
    expect(entries.map((e) => [e.kind, e.private])).toEqual([["combat", true], ["down", false]]);
  });
});
