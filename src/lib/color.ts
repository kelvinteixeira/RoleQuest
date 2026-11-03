/**
 * Converts the CSS colours used across the app (often `oklch(...)`) into hex
 * for libraries that only understand sRGB, such as three.js materials.
 */
const cache = new Map<string, string>();

function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  // OKLab → LMS → linear sRGB (Björn Ottosson's matrices).
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    lin
      .map((v) => {
        const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/** `oklch(0.62 0.12 230)` / `oklch(62% 0.12 230 / 0.5)` → `#rrggbb`; other formats pass through. */
export function toHexColor(css: string): string {
  const cached = cache.get(css);
  if (cached) return cached;
  const match = css.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  const hex = match ? oklchToHex(match[2] ? Number(match[1]) / 100 : Number(match[1]), Number(match[3]), Number(match[4])) : css;
  cache.set(css, hex);
  return hex;
}
