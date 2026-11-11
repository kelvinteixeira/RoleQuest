"use client";

import { useEffect, useRef, useState } from "react";
import { BookImage, FileDown, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/states";
import { toUserMessage } from "@/lib/errors";
import { toast } from "@/stores/toast.store";
import type { EpisodeScript } from "@/types/chronicle";
import { buildPdf, buildZip } from "../comic/files";
import { canvasBlob, renderComic } from "../comic/render";

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/**
 * The episode as a comic book: the pages as they will be downloaded, and the
 * downloads — one PDF, or the pages as PNG (a ZIP when there are several).
 * Everything is drawn in this browser.
 */
export default function ComicView({ script, blobs, campaignName, fileBase }: { script: EpisodeScript; blobs: Record<string, Blob>; campaignName: string; fileBase: string }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [saving, setSaving] = useState<"pdf" | "png" | null>(null);
  const shown = useRef<string[]>([]);

  // The preview follows the script and the pictures, a moment after the last change (typing redraws once).
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const canvases = await renderComic(script, blobs, campaignName);
        const urls = await Promise.all(canvases.map(async (c) => URL.createObjectURL(await canvasBlob(c, "image/jpeg", 0.8))));
        if (!alive) return urls.forEach((u) => URL.revokeObjectURL(u));
        shown.current.forEach((u) => URL.revokeObjectURL(u));
        shown.current = urls;
        setPages(urls);
      } catch (e) {
        if (alive) toast.error("Não deu para montar a HQ", toUserMessage(e));
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [script, blobs, campaignName]);

  useEffect(
    () => () => {
      shown.current.forEach((u) => URL.revokeObjectURL(u));
      shown.current = [];
    },
    [],
  );

  async function save(kind: "pdf" | "png") {
    setSaving(kind);
    try {
      const canvases = await renderComic(script, blobs, campaignName);
      let name: string;
      if (kind === "pdf") {
        const jpegs = await Promise.all(canvases.map(async (c) => ({ jpeg: await bytesOf(await canvasBlob(c, "image/jpeg", 0.92)), width: c.width, height: c.height })));
        name = `${fileBase}.pdf`;
        download(new Blob([buildPdf(jpegs, { title: `${campaignName} · ${script.title}` })], { type: "application/pdf" }), name);
      } else {
        const pngs = await Promise.all(canvases.map((c) => canvasBlob(c, "image/png")));
        if (pngs.length === 1) {
          name = `${fileBase}.png`;
          download(pngs[0], name);
        } else {
          const files = await Promise.all(pngs.map(async (png, i) => ({ name: `${fileBase}-${String(i + 1).padStart(2, "0")}.png`, data: await bytesOf(png) })));
          name = `${fileBase}-paginas.zip`;
          download(new Blob([buildZip(files)], { type: "application/zip" }), name);
        }
      }
      toast.success("HQ baixada", name);
    } catch (e) {
      console.error("Chronicles: HQ", e);
      toast.error("Não deu para baixar a HQ", toUserMessage(e));
    } finally {
      setSaving(null);
    }
  }

  if (!pages) return <LoadingState label="Montando as páginas…" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save("pdf")} loading={saving === "pdf"} disabled={saving !== null || pages.length === 0} leadingIcon={<FileDown className="size-4" />}>
          Baixar HQ (PDF)
        </Button>
        <Button variant="secondary" onClick={() => void save("png")} loading={saving === "png"} disabled={saving !== null || pages.length === 0} leadingIcon={<Images className="size-4" />}>
          Baixar páginas (PNG)
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-fg-subtle">
          <BookImage className="size-3.5" /> {pages.length} página(s) · A4
        </span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((url, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-line bg-surface-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={url} alt={`Página ${i + 1} da HQ`} className="block w-full" />
          </li>
        ))}
      </ol>
    </div>
  );
}
