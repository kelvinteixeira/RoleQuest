"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBlankMap, resizeMap, type MapDocument } from "@/features/map/model/map-document";
import { clampColumns, columnRange, gridForBackground, suggestedColumns, type MapBackground } from "@/features/map/model/background";
import { prepareMapImage } from "@/features/map/lib/image-import";
import { useMapImage } from "@/features/map/hooks/use-map-image";
import { mapImageService } from "@/services/map-image.service";
import { toast } from "@/stores/toast.store";
import { useMapEditorStore } from "../store/map-editor.store";

/**
 * Imported battle-map picture: import, line it up with the grid (squares
 * across + fine offset), fade it, swap it, remove it.
 */
export function BackgroundSection({ onResize }: { onResize: (doc: MapDocument) => void }) {
  const draft = useMapEditorStore((s) => s.draft);
  const dirty = useMapEditorStore((s) => s.dirty);
  const replace = useMapEditorStore((s) => s.replace);
  const input = useRef<HTMLInputElement>(null);
  const swapping = useRef(false);
  const [busy, setBusy] = useState(false);
  const imageUrl = useMapImage(draft?.background?.imageId);
  if (!draft) return null;
  const bg = draft.background;

  function apply(next: MapDocument, coalesce?: string) {
    replace(next, coalesce);
    onResize(next);
  }

  /** New background settings; the grid follows the squares across. `coalesce` merges a slider drag into one undo step. */
  function update(patch: Partial<MapBackground>, coalesce?: string) {
    if (!draft?.background) return;
    const background = { ...draft.background, ...patch };
    const { cols, rows } = gridForBackground(background);
    const resized = cols === draft.cols && rows === draft.rows ? draft : resizeMap(draft, cols, rows, "stone");
    apply({ ...resized, background }, coalesce);
  }

  function pick(swap: boolean) {
    // Importing (not swapping) starts a new map: don't drop unsaved work silently.
    if (!swap && dirty && !window.confirm("Importar cria um mapa novo e descarta as alterações não aplicadas deste rascunho. Continuar?")) return;
    swapping.current = swap;
    input.current?.click();
  }

  async function onFile(file: File | undefined) {
    if (!file || !draft) return;
    setBusy(true);
    try {
      const { blob, width, height } = await prepareMapImage(file);
      const imageId = await mapImageService.save(blob);
      if (swapping.current && draft.background) {
        // Same map, new picture (e.g. a sharper version): keep walls, props, notes and alignment.
        update({ imageId, width, height, cols: clampColumns(draft.background.cols, width, height) });
        toast.success("Imagem trocada", "O mapa e o alinhamento foram mantidos.");
      } else {
        const background: MapBackground = { imageId, width, height, cols: suggestedColumns(width, height), offsetX: 0, offsetY: 0, opacity: 1 };
        const { cols, rows } = gridForBackground(background);
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Mapa importado";
        // An imported map starts as plain floor under the picture; walls are painted on top.
        apply({ ...createBlankMap(cols, rows, "stone", name), background });
        toast.success("Imagem importada", "Ajuste as casas na largura até a grade bater com a do desenho.");
      }
    } catch (e) {
      toast.error("Não foi possível importar", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Imagem de fundo</h3>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      {!bg ? (
        <>
          <Button size="sm" variant="secondary" className="w-full" loading={busy} onClick={() => pick(false)} leadingIcon={<ImageUp className="size-3.5" />}>
            Importar imagem como mapa
          </Button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">Cria um mapa novo com o desenho por baixo da grade. PNG, JPG ou WebP; a imagem fica guardada neste navegador.</p>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {imageUrl === null && (
            <p className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />A imagem deste mapa não está neste navegador. Use “Trocar” para importá-la de novo; o alinhamento é mantido.
            </p>
          )}
          <ColumnsField key={`${bg.imageId}:${bg.cols}`} bg={bg} grid={`${draft.cols}×${draft.rows}`} onCommit={(cols) => cols !== bg.cols && update({ cols })} />
          <Slider label="Ajuste ↔" value={bg.offsetX} min={-1} max={1} step={0.02} onChange={(offsetX) => update({ offsetX }, "bg-offset-x")} format={(v) => v.toFixed(2)} />
          <Slider label="Ajuste ↕" value={bg.offsetY} min={-1} max={1} step={0.02} onChange={(offsetY) => update({ offsetY }, "bg-offset-y")} format={(v) => v.toFixed(2)} />
          <Slider label="Opacidade" value={bg.opacity} min={0.2} max={1} step={0.05} onChange={(opacity) => update({ opacity }, "bg-opacity")} format={(v) => `${Math.round(v * 100)}%`} />
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => pick(true)} loading={busy} leadingIcon={<ImageUp className="size-3.5" />}>
              Trocar
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => apply({ ...draft, background: undefined })} leadingIcon={<Trash2 className="size-3.5" />}>
              Remover
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-fg-subtle">Pinte “Parede de caverna” sobre as paredes do desenho para bloquear passagem e visão; portas e armadilhas funcionam como em qualquer mapa.</p>
        </div>
      )}
    </section>
  );
}

/**
 * Squares across. Applied on Enter or when leaving the field, never per
 * keystroke: an intermediate value ("3" on the way to "32") would crop the map.
 */
function ColumnsField({ bg, grid, onCommit }: { bg: MapBackground; grid: string; onCommit: (cols: number) => void }) {
  const [text, setText] = useState(String(bg.cols));
  const range = columnRange(bg.width, bg.height);
  const commit = () => {
    const n = Number(text);
    const cols = Number.isFinite(n) && n > 0 ? clampColumns(n, bg.width, bg.height) : bg.cols;
    setText(String(cols));
    onCommit(cols);
  };
  return (
    <label className="flex items-center gap-3 text-xs text-fg-muted">
      Casas na largura
      <input
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-8 w-20 rounded-md border border-line bg-surface-2 px-2 font-mono text-sm text-fg outline-none focus:border-accent/60"
      />
      <span className="text-[11px] text-fg-subtle">
        grade {grid} · {range.min}–{range.max}
      </span>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="flex items-center gap-3 text-xs text-fg-muted">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-accent-solid)]" />
      <span className="w-10 text-right font-mono text-[11px]">{format(value)}</span>
    </label>
  );
}
