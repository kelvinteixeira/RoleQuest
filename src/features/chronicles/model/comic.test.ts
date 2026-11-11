import { describe, expect, it } from "vitest";
import type { EpisodeScene } from "@/types/chronicle";
import { buildPdf, buildZip, crc32 } from "../comic/files";
import { PAGE, comicPages, comicRows, wrapText } from "./comic";

let n = 0;
const scene = (kind: EpisodeScene["kind"], extra: Partial<EpisodeScene> = {}): EpisodeScene => ({
  id: `s${++n}`,
  kind,
  narration: "A ponte range.",
  dialogue: [],
  imagePrompt: "",
  cast: [],
  camera: "still",
  mood: "calm",
  sfx: "",
  seconds: 4,
  roll: null,
  ...extra,
});

describe("the comic layout", () => {
  it("small panels go side by side; the ending, long text and loud moments take the whole row", () => {
    const loud = scene("scene", { sfx: "BOOM!", mood: "epic" });
    const chatty = scene("scene", { dialogue: [{ speaker: "A", line: "x" }, { speaker: "B", line: "y" }] });
    const rows = comicRows([scene("scene"), scene("roll"), loud, scene("scene"), chatty, scene("end")]);
    expect(rows.map((r) => r.length)).toEqual([2, 1, 1, 1, 1]);
  });

  it("the title scene is the cover; the story fills every page, inside the margins and without overlaps", () => {
    const scenes = [scene("title"), ...Array.from({ length: 9 }, () => scene("scene")), scene("end")];
    const pages = comicPages({ scenes });
    expect(pages[0]).toMatchObject({ kind: "cover", panels: [{ x: 0, y: 0, width: PAGE.width, height: PAGE.height }] });
    const story = pages.slice(1);
    expect(story.flatMap((p) => p.panels.map((x) => x.scene.id))).toEqual(scenes.slice(1).map((s) => s.id));
    for (const page of story) {
      for (const a of page.panels) {
        expect(a.x).toBeGreaterThanOrEqual(PAGE.margin);
        expect(a.x + a.width).toBeLessThanOrEqual(PAGE.width - PAGE.margin);
        expect(a.y + a.height).toBeLessThanOrEqual(PAGE.height - PAGE.margin - PAGE.footer + 2);
        for (const b of page.panels) {
          if (a === b) continue;
          const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(apart).toBe(true);
        }
      }
      // The last row ends at the bottom of the page (rounding aside).
      expect(Math.max(...page.panels.map((x) => x.y + x.height))).toBeGreaterThan(PAGE.height - PAGE.margin - PAGE.footer - 4);
    }
  });

  it("rows are shared evenly between pages, and a lone pair is stacked instead of two thin strips", () => {
    const wide = () => scene("scene", { sfx: "BOOM!", mood: "epic" });
    // 4 rows: 2 + 2, never 3 + 1.
    expect(comicPages({ scenes: [wide(), wide(), wide(), wide()] }).map((p) => p.panels.length)).toEqual([2, 2]);
    const [page] = comicPages({ scenes: [scene("scene"), scene("scene")] });
    expect(page.panels.map((x) => x.width)).toEqual([PAGE.width - PAGE.margin * 2, PAGE.width - PAGE.margin * 2]);
    expect(comicPages({ scenes: [] })).toEqual([]);
  });

  it("wraps text to the width, cutting a word that is wider than the box", () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapText("  a ponte   caiu no abismo ", 100, measure)).toEqual(["a ponte", "caiu no", "abismo"]);
    expect(wrapText("KRAAAAAAAAAAAAK ok", 50, measure)).toEqual(["KRAAA", "AAAAA", "AAAAK", "ok"]);
    expect(wrapText("", 50, measure)).toEqual([]);
  });
});

const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

describe("the comic files", () => {
  it("PDF: one page per image, and every cross-reference points at its object", () => {
    const jpeg = Uint8Array.of(0xff, 0xd8, 1, 2, 3, 0xff, 0xd9);
    const pdf = text(buildPdf([{ jpeg, width: 1240, height: 1754 }, { jpeg, width: 1240, height: 1754 }], { title: "Cinzas · A Ponte" }));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Count 2");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    // A4 wide, as tall as the image asks.
    expect(pdf).toContain("/MediaBox [0 0 595.28 842.03]");
    // The title is UTF-16BE hex, so "·" survives.
    expect(pdf).toContain("/Title <FEFF0043");
    expect(pdf).toContain("00B7");

    const xref = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const entries = pdf.slice(xref).split("\n").slice(3, 3 + 9);
    entries.forEach((entry, i) => {
      expect(entry).toMatch(/^\d{10} 00000 n $/);
      expect(pdf.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
    // The image bytes are in the file exactly as given.
    expect(pdf).toContain(`/Length ${jpeg.length} >>\nstream\n${text(jpeg)}\nendstream`);
  });

  it("ZIP: files stored as they are, with their checksum, and a directory that finds them", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const a = new TextEncoder().encode("página um");
    const b = Uint8Array.of(1, 2, 3, 4, 5);
    const zip = buildZip([{ name: "hq-01.png", data: a }, { name: "hq-02.png", data: b }], new Date(2026, 10, 11, 12, 30, 0));
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(a));
    expect(text(zip.subarray(30, 39))).toBe("hq-01.png");
    expect(zip.subarray(39, 39 + a.length)).toEqual(a);

    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true);
    expect(directory + view.getUint32(end + 12, true)).toBe(end);
    expect(view.getUint32(directory, true)).toBe(0x02014b50);
    // The second entry points at the second file's local header.
    const second = directory + 46 + 9;
    expect(view.getUint32(second, true)).toBe(0x02014b50);
    const offset = view.getUint32(second + 42, true);
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    expect(zip.subarray(offset + 39, offset + 39 + b.length)).toEqual(b);
  });
});
