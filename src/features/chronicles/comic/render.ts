/**
 * Draws the comic pages on canvases (client only): the panels laid out by
 * `comicPages`, each with its picture, caption box, speech balloons,
 * onomatopoeia and — for decisive rolls — the d20. Same look as the video.
 */
import type { EpisodeScene, EpisodeScript, SceneMood } from "@/types/chronicle";
import { PAGE, comicPages, wrapText, type ComicPage, type ComicPanel } from "../model/comic";
import { sceneImageKey } from "../model/script";

const FONT_TITLE = "Georgia, 'Times New Roman', serif";
const FONT_COMIC = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const FONT_SFX = "Impact, 'Arial Black', sans-serif";

/** A light colour wash per mood, top and bottom. */
const TINT: Record<SceneMood, [string, string]> = {
  calm: ["rgba(40,80,140,0.10)", "rgba(10,20,40,0.22)"],
  tense: ["rgba(90,20,80,0.14)", "rgba(10,0,20,0.30)"],
  epic: ["rgba(255,150,40,0.10)", "rgba(40,10,0,0.26)"],
  dark: ["rgba(0,10,20,0.26)", "rgba(0,0,0,0.42)"],
  triumphant: ["rgba(255,210,90,0.12)", "rgba(60,30,0,0.20)"],
  funny: ["rgba(120,255,200,0.08)", "rgba(0,40,30,0.18)"],
};
/** Panel colours when the scene has no picture yet. */
const BLANK: Record<SceneMood, [string, string]> = {
  calm: ["#1e3a5f", "#7aa2c8"],
  tense: ["#2a1b3d", "#8a4f7d"],
  epic: ["#3b1d0f", "#e0902f"],
  dark: ["#0b0f14", "#3b4a5a"],
  triumphant: ["#4a2a05", "#f5c451"],
  funny: ["#1f4a3a", "#7fd3a6"],
};

type Ctx = CanvasRenderingContext2D;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function vertical(ctx: Ctx, y: number, height: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y, 0, y + height);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/** The picture filling the box (cropped around its centre). */
function cover(ctx: Ctx, image: ImageBitmap, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height);
}

function lines(ctx: Ctx, list: string[], x: number, y: number, lineHeight: number) {
  list.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
}

interface TextBox {
  lines: string[];
  width: number;
  height: number;
}

/** The caption box (recordatório), top left. Returns where it ends. `draw: false` only measures. */
function drawCaption(ctx: Ctx, panel: ComicPanel, size: number, draw: boolean): number {
  const text = panel.scene.narration.trim();
  const top = panel.y + 14;
  if (!text) return top;
  const pad = Math.round(size * 0.55);
  ctx.font = `700 ${size}px ${FONT_COMIC}`;
  const wrapped = wrapText(text, panel.width * (panel.width < 700 ? 0.86 : 0.7) - pad * 2, (s) => ctx.measureText(s).width);
  const width = Math.max(...wrapped.map((l) => ctx.measureText(l).width)) + pad * 2;
  const height = wrapped.length * size * 1.25 + pad * 1.5;
  if (!draw) return top + height + 6;
  const x = panel.x + 14;
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(x + 6, top + 6, width, height);
  ctx.fillStyle = "#f6d86b";
  ctx.fillRect(x, top, width, height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111";
  ctx.strokeRect(x, top, width, height);
  ctx.fillStyle = "#1a1408";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines(ctx, wrapped, x + pad, top + pad * 0.75 + size * 0.1, size * 1.25);
  return top + height + 6;
}

/** Speech balloons stacked from the bottom, alternating sides. Returns the top of the stack. */
function drawBalloons(ctx: Ctx, panel: ComicPanel, size: number, draw: boolean): number {
  const { scene, x, y, width, height } = panel;
  const label = Math.round(size * 0.62);
  const padX = Math.round(size * 0.9);
  const padY = Math.round(size * 0.55);
  const tail = Math.round(size * 0.8);
  const maxWidth = width * (width < 700 ? 0.82 : 0.6);
  const boxes: (TextBox & { speaker: string })[] = scene.dialogue.slice(0, 3).map((d) => {
    ctx.font = `700 ${size}px ${FONT_COMIC}`;
    const wrapped = wrapText(d.line, maxWidth - padX * 2, (s) => ctx.measureText(s).width);
    const text = Math.max(0, ...wrapped.map((l) => ctx.measureText(l).width));
    ctx.font = `800 ${label}px ${FONT_COMIC}`;
    const speaker = d.speaker.toLocaleUpperCase("pt-BR");
    return { speaker, lines: wrapped, width: Math.max(text, ctx.measureText(speaker).width) + padX * 2, height: label * 1.3 + wrapped.length * size * 1.2 + padY * 2 };
  });
  let bottom = y + height - 16 - tail;
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    const left = i % 2 === 0;
    const bx = left ? x + 22 : x + width - 22 - box.width;
    const by = bottom - box.height;
    if (draw) {
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#111";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(bx + 5, by + 5, box.width, box.height, size);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(bx, by, box.width, box.height, size);
      ctx.fill();
      ctx.stroke();
      // The tail starts inside the balloon so its fill hides the border between its two edges.
      const from = left ? bx + size * 1.2 : bx + box.width - size * 1.2;
      const to = from + (left ? size : -size);
      const tip = from + (left ? -size * 0.2 : size * 0.2);
      ctx.beginPath();
      ctx.moveTo(from, by + box.height - 3);
      ctx.lineTo(tip, by + box.height + tail);
      ctx.lineTo(to, by + box.height - 3);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `800 ${label}px ${FONT_COMIC}`;
      ctx.fillStyle = "#7c3aed";
      ctx.fillText(box.speaker, bx + padX, by + padY);
      ctx.font = `700 ${size}px ${FONT_COMIC}`;
      ctx.fillStyle = "#111";
      lines(ctx, box.lines, bx + padX, by + padY + label * 1.3, size * 1.2);
    }
    bottom = by - 10 - tail;
  }
  return boxes.length ? bottom + tail : y + height;
}

function drawSfx(ctx: Ctx, panel: ComicPanel, text: string, below: number) {
  const size = clamp(panel.width * 0.13, 56, 150);
  ctx.save();
  ctx.translate(panel.x + panel.width * 0.7, Math.max(below + size * 0.75, panel.y + panel.height * 0.32));
  ctx.rotate((-9 * Math.PI) / 180);
  ctx.font = `${size}px ${FONT_SFX}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.fillStyle = "#b8202a";
  ctx.fillText(text, size * 0.06, size * 0.06);
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = "#1a0b00";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = "#ffd93b";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** The decisive roll: a d20 with the natural number, the total and a stamp on a 20 or a 1. */
function drawRoll(ctx: Ctx, panel: ComicPanel, roll: NonNullable<EpisodeScene["roll"]>, top: number) {
  const { x, y, width, height } = panel;
  const crit = roll.natural === 20;
  const fumble = roll.natural === 1;
  const color = crit ? "#b8860b" : fumble ? "#7f1d1d" : "#4c1d95";
  const glow = crit ? "#fde68a" : fumble ? "#fca5a5" : "#e9d5ff";
  ctx.fillStyle = vertical(ctx, y, height, [[0, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0.7)"]]);
  ctx.fillRect(x, y, width, height);

  const size = Math.min(width * 0.5, (y + height - top) * 0.62);
  const cx = x + width / 2;
  const cy = top + (y + height - top) * 0.46;
  const at = (px: number, py: number): [number, number] => [cx + (px - 100) * (size / 200), cy + (py - 100) * (size / 200)];
  const path = (points: [number, number][], close = true) => {
    ctx.beginPath();
    points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(...at(px, py)) : ctx.lineTo(...at(px, py))));
    if (close) ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = crit ? size * 0.2 : size * 0.08;
  ctx.fillStyle = color;
  path([[100, 6], [182, 53], [182, 147], [100, 194], [18, 147], [18, 53]]);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = glow;
  ctx.lineWidth = size * 0.03;
  ctx.stroke();
  ctx.lineWidth = size * 0.016;
  ctx.globalAlpha = 0.7;
  path([[100, 40], [155, 130], [45, 130]]);
  ctx.stroke();
  for (const edge of [[[100, 6], [100, 40]], [[182, 53], [155, 130]], [[182, 147], [155, 130]], [[18, 147], [45, 130]], [[18, 53], [45, 130]], [[45, 130], [100, 165], [155, 130]], [[100, 194], [100, 165]]] as [number, number][][]) {
    path(edge, false);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size * 0.34}px ${FONT_SFX}`;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillText(String(roll.natural), cx, cy + size * 0.02 + 4);
  ctx.fillStyle = "#fff";
  ctx.fillText(String(roll.natural), cx, cy + size * 0.02);

  const font = clamp(width * 0.034, 20, 36);
  ctx.font = `700 ${font}px ${FONT_COMIC}`;
  ctx.textBaseline = "top";
  const label = wrapText(`${roll.label} = ${roll.total}`, width * 0.86, (s) => ctx.measureText(s).width).slice(0, 2);
  ctx.lineJoin = "round";
  ctx.lineWidth = font * 0.22;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  label.forEach((line, i) => ctx.strokeText(line, cx, cy + size / 2 + font * 0.5 + i * font * 1.25));
  ctx.fillStyle = "#fff";
  lines(ctx, label, cx, cy + size / 2 + font * 0.5, font * 1.25);

  if (crit || fumble) {
    const stamp = clamp(width * 0.09, 40, 110);
    ctx.save();
    ctx.translate(cx, cy - size / 2 + stamp * 0.1);
    ctx.rotate((-6 * Math.PI) / 180);
    ctx.font = `${stamp}px ${FONT_SFX}`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = stamp * 0.1;
    ctx.strokeStyle = "#1a0b00";
    ctx.strokeText(crit ? "CRÍTICO!" : "FALHA CRÍTICA!", 0, 0);
    ctx.fillStyle = crit ? "#fde047" : "#f87171";
    ctx.fillText(crit ? "CRÍTICO!" : "FALHA CRÍTICA!", 0, 0);
    ctx.restore();
  }
}

function drawEnd(ctx: Ctx, panel: ComicPanel, script: EpisodeScript) {
  const { x, y, width, height } = panel;
  ctx.fillStyle = vertical(ctx, y, height, [[0.3, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.85)"]]);
  ctx.fillRect(x, y, width, height);
  const size = clamp(width * 0.075, 40, 84);
  const small = clamp(width * 0.022, 16, 24);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#fff";
  ctx.font = `italic ${size}px ${FONT_TITLE}`;
  ctx.fillText("Continua…", x + width / 2, y + height - small * 4.2);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#c4b5fd";
  ctx.font = `700 ${small}px ${FONT_COMIC}`;
  const credits = (script.characters.map((c) => c.name).join("  ·  ") || panel.scene.narration).toLocaleUpperCase("pt-BR");
  ctx.textBaseline = "top";
  lines(ctx, wrapText(credits, width * 0.86, (s) => ctx.measureText(s).width).slice(0, 2), x + width / 2, y + height - small * 3, small * 1.3);
}

function drawPanel(ctx: Ctx, panel: ComicPanel, script: EpisodeScript, image: ImageBitmap | undefined) {
  const { scene, x, y, width, height } = panel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  if (image) cover(ctx, image, x, y, width, height);
  else {
    ctx.fillStyle = vertical(ctx, y, height, [[0, BLANK[scene.mood][0]], [1, BLANK[scene.mood][1]]]);
    ctx.fillRect(x, y, width, height);
  }
  ctx.fillStyle = vertical(ctx, y, height, [[0, TINT[scene.mood][0]], [1, TINT[scene.mood][1]]]);
  ctx.fillRect(x, y, width, height);

  if (scene.kind === "end") drawEnd(ctx, panel, script);
  else {
    // The text shrinks until caption and balloons fit the panel without touching.
    const base = clamp(Math.round(width * 0.03), 21, 32);
    let size = base;
    for (const scale of [1, 0.86, 0.74]) {
      size = Math.round(base * scale);
      if (drawBalloons(ctx, panel, size, false) >= drawCaption(ctx, panel, size, false) + 8) break;
    }
    // The die goes under the caption box, in the room left below it.
    if (scene.kind === "roll" && scene.roll) drawRoll(ctx, panel, scene.roll, drawCaption(ctx, panel, size, false));
    const captionEnd = drawCaption(ctx, panel, size, true);
    if (scene.kind === "scene" && scene.sfx) drawSfx(ctx, panel, scene.sfx, captionEnd);
    drawBalloons(ctx, panel, size, true);
  }
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#0b0b10";
  ctx.strokeRect(x, y, width, height);
}

function drawCover(ctx: Ctx, script: EpisodeScript, campaignName: string, image: ImageBitmap | undefined) {
  const { width, height } = PAGE;
  ctx.fillStyle = "#06050a";
  ctx.fillRect(0, 0, width, height);
  if (image) {
    ctx.globalAlpha = 0.7;
    cover(ctx, image, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = vertical(ctx, 0, height, [[0, "rgba(6,5,10,0.55)"], [0.35, "rgba(6,5,10,0.1)"], [0.6, "rgba(6,5,10,0.55)"], [1, "rgba(6,5,10,0.95)"]]);
  ctx.fillRect(0, 0, width, height);

  const measure = (s: string) => ctx.measureText(s).width;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 30;

  ctx.font = `700 34px ${FONT_COMIC}`;
  ctx.fillStyle = "#c4b5fd";
  lines(ctx, wrapText(campaignName.toLocaleUpperCase("pt-BR"), width - 240, measure).slice(0, 2), width / 2, 150, 44);

  // The title sits on the lower part, above the logline, whatever its length.
  ctx.font = `italic 36px ${FONT_TITLE}`;
  const logline = script.logline ? wrapText(script.logline, width - 280, measure).slice(0, 4) : [];
  let titleSize = 124;
  let title: string[] = [];
  for (; titleSize >= 64; titleSize -= 12) {
    ctx.font = `700 ${titleSize}px ${FONT_TITLE}`;
    title = wrapText(script.title, width - 200, measure);
    if (title.length <= 3) break;
  }
  const block = title.length * titleSize * 1.08 + (logline.length ? 40 + logline.length * 48 : 0);
  let y = height - 200 - block;
  ctx.fillStyle = "#fff";
  lines(ctx, title, width / 2, y, titleSize * 1.08);
  y += title.length * titleSize * 1.08 + 40;
  ctx.font = `italic 36px ${FONT_TITLE}`;
  ctx.fillStyle = "#e5e1f0";
  lines(ctx, logline, width / 2, y, 48);

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.font = `700 20px ${FONT_COMIC}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("ROLE QUEST  ·  CHRONICLES", width / 2, height - 90);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#0b0b10";
  ctx.strokeRect(5, 5, width - 10, height - 10);
}

function drawPage(ctx: Ctx, page: ComicPage, number: number, script: EpisodeScript, campaignName: string, images: Record<string, ImageBitmap>) {
  if (page.kind === "cover") {
    drawCover(ctx, script, campaignName, images[sceneImageKey(page.panels[0].scene)]);
    return;
  }
  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  for (const panel of page.panels) drawPanel(ctx, panel, script, images[sceneImageKey(panel.scene)]);
  ctx.font = `700 20px ${FONT_COMIC}`;
  ctx.fillStyle = "#6b6459";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const footer = `${campaignName}  ·  ${script.title}`;
  ctx.fillText(footer.length > 80 ? `${footer.slice(0, 79)}…` : footer, PAGE.margin, PAGE.height - PAGE.margin + 6);
  ctx.textAlign = "right";
  ctx.fillText(String(number), PAGE.width - PAGE.margin, PAGE.height - PAGE.margin + 6);
}

/** Every page of the comic as a canvas. `blobs`: image key -> picture (scenes without one get a colour panel). */
export async function renderComic(script: EpisodeScript, blobs: Record<string, Blob>, campaignName: string, options: { watermark?: boolean } = {}): Promise<HTMLCanvasElement[]> {
  const pages = comicPages(script);
  const images: Record<string, ImageBitmap> = {};
  await Promise.all(
    script.scenes.map(async (scene) => {
      const key = sceneImageKey(scene);
      const blob = blobs[key];
      // A picture that doesn't decode leaves its panel in colour instead of failing the whole comic.
      if (blob) await createImageBitmap(blob).then((b) => (images[key] = b), () => undefined);
    }),
  );
  try {
    let number = 0;
    return pages.map((page) => {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE.width;
      canvas.height = PAGE.height;
      const ctx = canvas.getContext("2d")!;
      drawPage(ctx, page, page.kind === "story" ? ++number : 0, script, campaignName, images);
      // Free plan: the mark sits centred in the bottom margin.
      if (options.watermark) {
        ctx.save();
        ctx.font = "600 22px 'Trebuchet MS', Arial, sans-serif";
        ctx.fillStyle = "rgba(20, 16, 28, 0.55)";
        ctx.textAlign = "center";
        ctx.fillText("feito com Role Quest", PAGE.width / 2, PAGE.height - PAGE.margin + 6);
        ctx.restore();
      }
      return canvas;
    });
  } finally {
    for (const image of Object.values(images)) image.close();
  }
}

export const canvasBlob = (canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não deu para gerar a página."))), type, quality));
