"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { cellIndex, PROP_BY_ID, TERRAINS, type MapDocument } from "../model/map-document";

/** Top-down preview of a map drawn on a small canvas: terrain colours, props as dots. */
export function MapThumbnail({ doc, className }: { doc: MapDocument; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const cell = 4;
    ctx.canvas.width = doc.cols * cell;
    ctx.canvas.height = doc.rows * cell;
    for (let y = 0; y < doc.rows; y++) {
      for (let x = 0; x < doc.cols; x++) {
        const t = TERRAINS[doc.terrain[cellIndex(doc, x, y)]];
        ctx.fillStyle = t?.kind === "water" ? "#3f8fb5" : (t?.color ?? "#000");
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    for (const p of doc.props) {
      const def = PROP_BY_ID.get(p.propId);
      if (!def) continue;
      ctx.fillStyle = def.feature ? "#f59e0b" : def.category === "tree" ? "#1f4d1f" : "#3a3540";
      ctx.fillRect(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2);
    }
  }, [doc]);

  return <canvas ref={canvas} aria-hidden className={cn("block h-auto w-full rounded-md border border-black/40 [image-rendering:pixelated]", className)} />;
}
