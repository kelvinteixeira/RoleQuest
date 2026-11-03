"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/*
 * Role Quest mark, redrawn from public/brand/role-quest-logo.webp:
 * a d20 wireframe with a "play" triangle on its face and a violet orbit.
 * The orbit's back arc is hidden behind the die and its front arc cuts
 * through the die's lines, using masks so the mark works on any background.
 */
const HEX = "32,4 56,18 56,46 32,60 8,46 8,18";
const EDGES =
  "M32 4 32 14 M8 18 32 14 56 18 M8 18 15 42 M56 18 49 42 M32 14 15 42 49 42Z M8 46 15 42 M56 46 49 42 M15 42 32 60 49 42";
/** Orbit ellipse, tilted like the original artwork. */
const ORBIT = { cx: 32, cy: 35, rx: 31, ry: 9.5, rotate: -25 };
/** Front of the orbit as a crescent: thick at the bottom, tapering to points at both ends. */
const CRESCENT = "M1 35 A31 11 0 0 0 63 35 A31 7 0 0 1 1 35Z";
/** Rounded play triangle centred on the die face. */
const PLAY = "27.6,25.6 27.6,39 39.2,32.3";

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gradient = `${id}-orbit`;
  const behind = `${id}-behind`;
  const cut = `${id}-cut`;
  const { cx, cy, rx, ry, rotate } = ORBIT;
  const tilt = `rotate(${rotate} ${cx} ${cy})`;

  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--color-brand-from)" />
          <stop offset="1" stopColor="var(--color-brand-to)" />
        </linearGradient>
        {/* Back arc disappears inside the die. */}
        <mask id={behind} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="white" />
          <polygon points={HEX} fill="black" />
        </mask>
        {/* Die lines are cut where the front arc passes over them. */}
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="white" />
          <path d={CRESCENT} transform={tilt} fill="black" stroke="black" strokeWidth="3" strokeLinejoin="round" />
        </mask>
      </defs>

      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={tilt} fill="none" stroke={`url(#${gradient})`} strokeWidth="1.8" mask={`url(#${behind})`} />

      <g mask={`url(#${cut})`} fill="none" stroke="var(--color-brand-ink)" strokeWidth="2.3" strokeLinejoin="miter">
        <polygon points={HEX} />
        <path d={EDGES} />
      </g>

      <polygon points={PLAY} fill="var(--color-accent-solid)" stroke="var(--color-accent-solid)" strokeWidth="2.4" strokeLinejoin="round" />

      <path d={CRESCENT} transform={tilt} fill={`url(#${gradient})`} />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-[1.15rem] font-semibold tracking-tight text-fg">
          Role<span className="text-accent"> Quest</span>
        </span>
      )}
    </span>
  );
}
