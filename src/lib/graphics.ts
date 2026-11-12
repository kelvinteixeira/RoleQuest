/**
 * 3D quality for the table. "auto" picks from the device: phones and machines
 * with few cores or little memory start on low, which turns shadows off and
 * draws fewer pixels (the biggest costs on weak GPUs).
 */
export type GraphicsQuality = "auto" | "low" | "medium" | "high";

export interface GraphicsProfile {
  level: Exclude<GraphicsQuality, "auto">;
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
}

const PROFILES: Record<GraphicsProfile["level"], GraphicsProfile> = {
  low: { level: "low", dpr: [0.75, 1], shadows: false, shadowMapSize: 512, antialias: false },
  medium: { level: "medium", dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, antialias: true },
  high: { level: "high", dpr: [1, 2], shadows: true, shadowMapSize: 2048, antialias: true },
};

export interface DeviceHints {
  cores?: number;
  memoryGb?: number;
  coarsePointer?: boolean;
  screenWidth?: number;
}

export function detectLevel(d: DeviceHints): GraphicsProfile["level"] {
  const phone = !!d.coarsePointer && (d.screenWidth ?? 9999) < 900;
  if ((d.cores ?? 8) <= 4 || (d.memoryGb ?? 8) <= 3) return "low";
  if (phone || (d.cores ?? 8) <= 6 || (d.memoryGb ?? 8) <= 4) return "medium";
  return "high";
}

export function deviceHints(): DeviceHints {
  if (typeof window === "undefined") return {};
  return {
    cores: navigator.hardwareConcurrency,
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches,
    screenWidth: window.screen?.width,
  };
}

export function graphicsProfile(quality: GraphicsQuality, hints: DeviceHints = deviceHints()): GraphicsProfile {
  return PROFILES[quality === "auto" ? detectLevel(hints) : quality];
}
