/**
 * The episode as a comic book: which scenes share a page and where each panel
 * sits. Pure layout (no canvas), so it is the same for the preview, the PNG
 * pages and the PDF.
 */
import type { EpisodeScene, EpisodeScript } from "@/types/chronicle";

/** An A4 page at 150 dpi. */
export const PAGE = { width: 1240, height: 1754, margin: 56, gutter: 22, footer: 46 } as const;
export const ROWS_PER_PAGE = 3;

export interface ComicPanel {
  scene: EpisodeScene;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComicPage {
  /** The cover is the title scene over the whole page; story pages are numbered from 1. */
  kind: "cover" | "story";
  panels: ComicPanel[];
}

/** A panel that needs the whole row: the ending, a lot of text, or a big loud moment. */
const isWide = (s: EpisodeScene) =>
  s.kind === "end" || s.dialogue.length >= 2 || s.narration.length > 150 || (s.kind === "scene" && !!s.sfx && (s.mood === "epic" || s.mood === "triumphant"));

/** Scenes in rows: two small panels side by side, or one wide panel alone. */
export function comicRows(scenes: EpisodeScene[]): EpisodeScene[][] {
  const rows: EpisodeScene[][] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const next = scenes[i + 1];
    if (!isWide(scene) && next && !isWide(next)) {
      rows.push([scene, next]);
      i++;
    } else rows.push([scene]);
  }
  return rows;
}

/** Rows shared evenly between the pages (4 rows are 2 + 2, never 3 + 1). */
function paginate<T>(rows: T[]): T[][] {
  const count = Math.ceil(rows.length / ROWS_PER_PAGE);
  const base = Math.floor(rows.length / count);
  const extra = rows.length % count;
  const pages: T[][] = [];
  let at = 0;
  for (let p = 0; p < count; p++) {
    const size = base + (p < extra ? 1 : 0);
    pages.push(rows.slice(at, at + size));
    at += size;
  }
  return pages;
}

/** The pages of the comic: a cover (when the script has a title scene) and the story. */
export function comicPages(script: Pick<EpisodeScript, "scenes">): ComicPage[] {
  const cover = script.scenes.find((s) => s.kind === "title");
  const story = script.scenes.filter((s) => s.kind !== "title");
  const pages: ComicPage[] = [];
  if (cover) pages.push({ kind: "cover", panels: [{ scene: cover, x: 0, y: 0, width: PAGE.width, height: PAGE.height }] });
  if (story.length === 0) return pages;

  const innerWidth = PAGE.width - PAGE.margin * 2;
  const innerHeight = PAGE.height - PAGE.margin * 2 - PAGE.footer;
  let pairs = 0;
  for (let rows of paginate(comicRows(story))) {
    // Two panels alone on a page would be two thin strips: stack them instead.
    if (rows.length === 1 && rows[0].length === 2) rows = [[rows[0][0]], [rows[0][1]]];
    const weights = rows.map((r) => (r.length === 1 ? 1.2 : 1));
    const unit = (innerHeight - PAGE.gutter * (rows.length - 1)) / weights.reduce((a, b) => a + b, 0);
    const panels: ComicPanel[] = [];
    let y = PAGE.margin;
    rows.forEach((row, r) => {
      const height = Math.round(unit * weights[r]);
      if (row.length === 1) panels.push({ scene: row[0], x: PAGE.margin, y, width: innerWidth, height });
      else {
        // The split moves from side to side so the pages don't look like a grid.
        const left = Math.round((innerWidth - PAGE.gutter) * (pairs++ % 2 === 0 ? 0.56 : 0.44));
        panels.push({ scene: row[0], x: PAGE.margin, y, width: left, height });
        panels.push({ scene: row[1], x: PAGE.margin + left + PAGE.gutter, y, width: innerWidth - PAGE.gutter - left, height });
      }
      y += height + PAGE.gutter;
    });
    pages.push({ kind: "story", panels });
  }
  return pages;
}

/** Breaks a text into lines that fit `maxWidth`; a word wider than the box is cut. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    let rest = word;
    while (rest.length > 1 && measure(rest) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}
