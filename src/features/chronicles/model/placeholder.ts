/**
 * A stand-in panel drawn in the browser when no image AI is configured: a
 * mood-coloured gradient with a soft vignette and the scene's number. Client only.
 */
import type { SceneMood } from "@/types/chronicle";

const MOOD_COLORS: Record<SceneMood, [string, string]> = {
  calm: ["#1e3a5f", "#7aa2c8"],
  tense: ["#2a1b3d", "#8a4f7d"],
  epic: ["#3b1d0f", "#e0902f"],
  dark: ["#0b0f14", "#3b4a5a"],
  triumphant: ["#4a2a05", "#f5c451"],
  funny: ["#1f4a3a", "#7fd3a6"],
};

export async function placeholderImage(mood: SceneMood, label: string, aspect: "16:9" | "1:1"): Promise<Blob> {
  const width = aspect === "16:9" ? 1280 : 720;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const [from, to] = MOOD_COLORS[mood];
  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, from);
  sky.addColorStop(1, to);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // Hills and a glow, so the camera moves have something to move over.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.75);
  for (let x = 0; x <= width; x += 40) ctx.lineTo(x, height * 0.7 + Math.sin(x / 90) * 30 + Math.sin(x / 37) * 12);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();
  const glow = ctx.createRadialGradient(width * 0.7, height * 0.3, 10, width * 0.7, height * 0.3, height * 0.5);
  glow.addColorStop(0, "rgba(255,240,200,0.55)");
  glow.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold ${Math.round(height / 8)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, height / 2);
  ctx.font = `${Math.round(height / 28)}px Georgia, serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("imagem de exemplo — configure o Gemini para ilustrar", width / 2, height / 2 + height / 12);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}
