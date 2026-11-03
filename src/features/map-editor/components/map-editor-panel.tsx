"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Brush,
  Circle,
  Eraser,
  LayoutTemplate,
  PaintBucket,
  Redo2,
  RotateCw,
  Slash,
  Square,
  SquareDashed,
  Trees,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  MAP_LIMITS,
  PROP_CATEGORY_LABEL,
  PROPS,
  resizeMap,
  TERRAIN_ORDER,
  TERRAINS,
  type PropCategory,
} from "@/features/map/model/map-document";
import { MAP_TEMPLATES } from "@/features/map/model/templates";
import { useMapEditorStore, type EditorShape, type EditorTool } from "../store/map-editor.store";

const TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: "terrain", label: "Terreno", icon: Brush },
  { id: "props", label: "Objetos", icon: Trees },
  { id: "raise", label: "Elevar", icon: ArrowUpToLine },
  { id: "lower", label: "Rebaixar", icon: ArrowDownToLine },
  { id: "erase", label: "Borracha", icon: Eraser },
  { id: "rotate", label: "Girar objeto", icon: RotateCw },
];

const SHAPES: { id: EditorShape; label: string; icon: LucideIcon }[] = [
  { id: "brush", label: "Pincel", icon: Brush },
  { id: "rect", label: "Retângulo", icon: Square },
  { id: "rect-outline", label: "Contorno", icon: SquareDashed },
  { id: "ellipse", label: "Elipse", icon: Circle },
  { id: "line", label: "Linha", icon: Slash },
  { id: "fill", label: "Balde", icon: PaintBucket },
];

const CATEGORIES: PropCategory[] = ["tree", "rock", "plant", "structure"];

/** GM map editor controls. The 3D view reads the same store to preview and apply strokes. */
export function MapEditorPanel({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  const s = useMapEditorStore();
  const [category, setCategory] = useState<PropCategory>("tree");
  const [size, setSize] = useState({ cols: s.draft?.cols ?? 30, rows: s.draft?.rows ?? 20 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useMapEditorStore.getState().redo();
        else useMapEditorStore.getState().undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        useMapEditorStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!s.draft) return null;
  const draft = s.draft;
  const showBrush = s.shape === "brush" || s.shape === "line";

  function togglePropSelection(id: string) {
    const has = s.propIds.includes(id);
    s.set({ propIds: has ? s.propIds.filter((p) => p !== id) : [...s.propIds, id] });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => s.replace({ ...draft, name: e.target.value })}
          aria-label="Nome do mapa"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-3 font-display text-sm font-semibold outline-none focus:border-accent/60"
        />
        <Button size="icon-sm" variant="ghost" onClick={s.undo} disabled={!s.past.length} aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)">
          <Undo2 className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={s.redo} disabled={!s.future.length} aria-label="Refazer (Ctrl+Y)" title="Refazer (Ctrl+Y)">
          <Redo2 className="size-4" />
        </Button>
      </div>

      <Section title="Ferramenta">
        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <ToolButton key={id} active={s.tool === id} onClick={() => s.set({ tool: id, shape: id === "rotate" ? "brush" : s.shape })} icon={<Icon className="size-4" />}>
              {label}
            </ToolButton>
          ))}
        </div>
      </Section>

      {s.tool !== "rotate" && (
        <Section title="Forma (encaixa na grade)">
          <div className="grid grid-cols-6 gap-1">
            {SHAPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => s.set({ shape: id })}
                aria-pressed={s.shape === id}
                title={label}
                aria-label={label}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border transition-colors",
                  s.shape === id ? "border-accent/60 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          {showBrush && (
            <label className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
              {s.shape === "line" ? "Espessura" : "Tamanho"}
              <input type="range" min={1} max={5} value={s.brushSize} onChange={(e) => s.set({ brushSize: Number(e.target.value) })} className="flex-1 accent-[var(--color-accent-solid)]" />
              <span className="w-8 text-right font-mono">{s.brushSize}×{s.brushSize}</span>
            </label>
          )}
        </Section>
      )}

      {s.tool === "terrain" && (
        <Section title="Terreno">
          <div className="grid grid-cols-2 gap-1.5">
            {TERRAIN_ORDER.map((id) => {
              const t = TERRAINS[id];
              return (
                <button
                  key={id}
                  onClick={() => s.set({ terrain: id })}
                  aria-pressed={s.terrain === id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition-colors",
                    s.terrain === id ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-fg-muted hover:text-fg",
                  )}
                >
                  <span
                    className="size-6 shrink-0 rounded-md border border-black/30"
                    style={{ background: t.kind === "water" ? `linear-gradient(135deg, #3f8fb5, ${t.color})` : `linear-gradient(180deg, ${t.color} 60%, ${t.side} 60%)` }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{t.label}</span>
                    {t.blocks && <span className="block text-[10px] text-fg-subtle">bloqueia</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {s.tool === "props" && (
        <Section title="Objetos">
          <div className="mb-2 flex gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn("h-7 shrink-0 rounded-full border px-2.5 text-xs", category === c ? "border-accent/50 bg-accent/12 text-accent" : "border-line text-fg-muted")}
              >
                {PROP_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {PROPS.filter((p) => p.category === category).map((p) => (
              <label key={p.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs", s.propIds.includes(p.id) ? "bg-accent/10 text-fg" : "text-fg-muted hover:bg-surface-2")}>
                <input type="checkbox" checked={s.propIds.includes(p.id)} onChange={() => togglePropSelection(p.id)} className="accent-[var(--color-accent-solid)]" />
                <span className="truncate">{p.label}</span>
                {p.blocks && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-danger/70" title="Bloqueia movimento" />}
              </label>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
            Densidade
            <input type="range" min={0.05} max={1} step={0.05} value={s.density} onChange={(e) => s.set({ density: Number(e.target.value) })} className="flex-1 accent-[var(--color-accent-solid)]" />
            <span className="w-9 text-right font-mono">{Math.round(s.density * 100)}%</span>
          </label>
          <p className="mt-1 text-[11px] text-fg-subtle">
            {s.propIds.length === 0 ? "Marque ao menos um objeto." : `Sorteia entre ${s.propIds.length} objeto(s). Use Retângulo ou Elipse para espalhar uma floresta.`}
          </p>
        </Section>
      )}

      <Section title="Modelos e tamanho">
        <div className="flex flex-col gap-1.5">
          {MAP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                const doc = t.build();
                s.replace(doc);
                setSize({ cols: doc.cols, rows: doc.rows });
              }}
              className="flex items-start gap-2 rounded-lg border border-line p-2 text-left hover:border-line-strong"
            >
              <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-xs font-medium">{t.label}</span>
                <span className="block text-[11px] text-fg-subtle">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <NumberField label="Colunas" value={size.cols} onChange={(cols) => setSize({ ...size, cols })} />
          <NumberField label="Linhas" value={size.rows} onChange={(rows) => setSize({ ...size, rows })} />
          <Button size="sm" variant="secondary" onClick={() => s.replace(resizeMap(draft, size.cols, size.rows))} disabled={size.cols === draft.cols && size.rows === draft.rows}>
            Redimensionar
          </Button>
        </div>
      </Section>

      <p className="text-[11px] leading-relaxed text-fg-subtle">
        Botão esquerdo desenha · botão direito move a câmera · rolagem aproxima · botão do meio gira. Ctrl+Z desfaz.
      </p>

      <div className="sticky bottom-0 mt-auto flex gap-2 border-t border-line bg-surface/95 pt-3 backdrop-blur">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Descartar
        </Button>
        <Button onClick={onApply} className="flex-1" disabled={!s.dirty}>
          Aplicar ao mapa
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

function ToolButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-colors",
        active ? "border-accent/60 bg-accent/12 text-accent" : "border-line text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-[11px] text-fg-subtle">
      {label}
      <input
        type="number"
        min={MAP_LIMITS.min}
        max={MAP_LIMITS.max}
        value={value}
        onChange={(e) => onChange(Math.max(MAP_LIMITS.min, Math.min(MAP_LIMITS.max, Number(e.target.value) || MAP_LIMITS.min)))}
        className="h-8 w-full rounded-md border border-line bg-surface-2 px-2 font-mono text-sm text-fg outline-none focus:border-accent/60"
      />
    </label>
  );
}
