"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number };

/** Segmented tab list with an animated indicator. Content rendering is up to the caller. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface p-0.5", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-surface-3"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{item.label}</span>
            {item.count !== undefined && (
              <span className="relative font-mono text-[10px] tabular-nums text-fg-subtle">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
