import type { CSSProperties, ReactNode } from "react";
import { Cpu, Dices, Droplet, Eye, Flame, Ghost, Moon, Shield, Sparkles, Star, Sword, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SystemGlyph, SystemTheme } from "@/types/system";

const GLYPHS: Record<SystemGlyph, LucideIcon> = {
  sword: Sword,
  shield: Shield,
  eye: Eye,
  droplet: Droplet,
  moon: Moon,
  flame: Flame,
  star: Star,
  ghost: Ghost,
  cpu: Cpu,
  dices: Dices,
  sparkles: Sparkles,
};

/** Exposes a system's accent as --system-accent to everything inside it. */
export function systemStyle(theme: SystemTheme): CSSProperties {
  return { ["--system-accent" as string]: theme.accent };
}

export function SystemScope({ theme, className, children }: { theme: SystemTheme; className?: string; children: ReactNode }) {
  return (
    <div className={className} style={systemStyle(theme)}>
      {children}
    </div>
  );
}

export function SystemGlyphIcon({ glyph, className }: { glyph: SystemGlyph; className?: string }) {
  const Icon = GLYPHS[glyph];
  return <Icon className={className} aria-hidden />;
}

/** Small square emblem with the system glyph tinted by its accent. */
export function SystemEmblem({ theme, size = "md", className }: { theme: SystemTheme; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "size-6 rounded-md [&_svg]:size-3.5", md: "size-9 rounded-lg [&_svg]:size-4", lg: "size-12 rounded-xl [&_svg]:size-6" };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center border border-system/25 bg-system/12 text-system", sizes[size], className)}
      style={systemStyle(theme)}
    >
      <SystemGlyphIcon glyph={theme.glyph} />
    </span>
  );
}

export function SystemTag({ theme, label, className }: { theme: SystemTheme; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md border border-system/25 bg-system/10 px-1.5 text-[11px] font-medium text-system",
        className,
      )}
      style={systemStyle(theme)}
    >
      <SystemGlyphIcon glyph={theme.glyph} className="size-3" />
      {label}
    </span>
  );
}

export function coverGradient([from, to]: [string, string]): string {
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
