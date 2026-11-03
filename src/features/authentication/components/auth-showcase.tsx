import { Clapperboard, Dices, Map as MapIcon } from "lucide-react";

const TOKENS = [
  { x: 3, y: 4, color: "oklch(0.62 0.12 230)", label: "IM" },
  { x: 5, y: 3, color: "oklch(0.6 0.12 50)", label: "GP" },
  { x: 4, y: 6, color: "oklch(0.58 0.17 300)", label: "NX" },
  { x: 9, y: 5, color: "oklch(0.55 0.2 20)", label: "!", enemy: true },
];

/** Decorative right-hand panel for auth screens: a quiet tabletop vignette. */
export function AuthShowcase() {
  return (
    <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:block" aria-hidden>
      <div className="bg-tabletop-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,oklch(0.6_0.26_302/0.2),transparent_45%)]" />

      {/* Tokens on a 32px grid */}
      <div className="absolute left-1/2 top-[38%] h-[320px] w-[384px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute rounded-full border border-dashed border-accent/40" style={{ left: 3 * 32 - 48, top: 4 * 32 - 48, width: 128, height: 128 }} />
        {TOKENS.map((t) => (
          <span
            key={t.label}
            className="absolute flex size-8 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-lg ring-2"
            style={{
              left: t.x * 32,
              top: t.y * 32,
              background: t.color,
              boxShadow: t.enemy ? "0 0 24px oklch(0.6 0.2 25 / 0.5)" : undefined,
              ["--tw-ring-color" as string]: t.enemy ? "oklch(0.68 0.19 25 / 0.6)" : "oklch(1 0 0 / 0.25)",
            }}
          >
            {t.label}
          </span>
        ))}
        <svg className="absolute inset-0 size-full overflow-visible">
          <line x1={5 * 32 + 16} y1={3 * 32 + 16} x2={8 * 32 + 16} y2={5 * 32 + 16} stroke="var(--color-accent)" strokeDasharray="4 4" strokeOpacity="0.7" />
        </svg>
        <span className="absolute rounded bg-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-accent" style={{ left: 6.5 * 32, top: 3.6 * 32 }}>
          15 ft
        </span>
      </div>

      <div className="absolute inset-x-12 bottom-12">
        <p className="font-display text-3xl leading-tight text-fg text-balance-pretty">
          Toda campanha merece ser lembrada como uma série.
        </p>
        <ul className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <li className="flex flex-col gap-2 text-fg-muted">
            <MapIcon className="size-4 text-accent" /> Mesa virtual com mapas por tiles
          </li>
          <li className="flex flex-col gap-2 text-fg-muted">
            <Dices className="size-4 text-accent" /> 10 sistemas e o seu próprio
          </li>
          <li className="flex flex-col gap-2 text-fg-muted">
            <Clapperboard className="size-4 text-accent" /> Chronicles Studio: da mesa para as telas
          </li>
        </ul>
      </div>
    </aside>
  );
}
