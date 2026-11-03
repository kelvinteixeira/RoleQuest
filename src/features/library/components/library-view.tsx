"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Grid3x3, Map as MapIcon, Music, Package, Upload, UsersRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhaseBadge, Skeleton } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { formatRelative } from "@/lib/format";
import { collectionService } from "@/services/collection.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { coverGradient } from "@/features/systems/components/system-identity";
import type { LibraryAsset, ResourceCategory } from "@/types/library";
import type { MapBiome } from "@/types/system";

type Tab = "scenarios" | "resources";

const BIOME_LABEL: Record<MapBiome, string> = {
  forest: "Floresta",
  castle: "Castelo",
  dungeon: "Masmorra",
  city: "Cidade",
  village: "Vila",
  cave: "Caverna",
  interior: "Interior",
  futuristic: "Futurista",
  supernatural: "Sobrenatural",
  wilderness: "Ermos",
};

const CATEGORY: Record<ResourceCategory, { label: string; unit: string; icon: LucideIcon }> = {
  tileset: { label: "Tileset", unit: "tiles", icon: Grid3x3 },
  "token-pack": { label: "Tokens", unit: "tokens", icon: UsersRound },
  "audio-pack": { label: "Áudio", unit: "faixas", icon: Music },
  handout: { label: "Documentos", unit: "itens", icon: FileText },
};

export function LibraryView() {
  const user = useCurrentUser();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "resources" ? "resources" : "scenarios");
  const { data, status, error, reload } = useAsync(() => collectionService.listLibrary(user.id), [user.id]);

  const items = (data ?? []).filter((a) => (tab === "scenarios" ? a.kind === "scenario" : a.kind === "resource"));

  return (
    <PageContainer>
      <PageHeader
        title="Biblioteca"
        description="Cenários e recursos que você reaproveita entre campanhas."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled leadingIcon={<Upload className="size-4" />} title="Upload de arquivos — Fase 7 (Supabase Storage)">
              Importar arquivos
            </Button>
            <PhaseBadge phase={7} />
          </div>
        }
      />

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: "scenarios", label: "Cenários", count: data?.filter((a) => a.kind === "scenario").length },
          { value: "resources", label: "Recursos", count: data?.filter((a) => a.kind === "resource").length },
        ]}
      />

      {status === "error" && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={tab === "scenarios" ? <MapIcon /> : <Package />} title="Nada por aqui ainda" description="Cenários criados no editor de mapas (Fase 3) aparecerão aqui." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function AssetCard({ asset }: { asset: LibraryAsset }) {
  const category = asset.category ? CATEGORY[asset.category] : null;
  const Icon = category?.icon ?? MapIcon;
  return (
    <article className="surface-card flex flex-col overflow-hidden">
      <div className="relative h-32" style={{ background: coverGradient(asset.previewGradient) }}>
        <div className="bg-tabletop-grid absolute inset-0 opacity-70" />
        <Icon className="absolute bottom-3 right-3 size-6 text-white/30" />
        <span className="absolute left-3 top-3 rounded-md bg-canvas/70 px-1.5 py-0.5 text-[11px] text-fg-muted backdrop-blur">
          {asset.biome ? BIOME_LABEL[asset.biome] : category?.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-medium">{asset.title}</h3>
        <p className="line-clamp-2 text-xs text-fg-subtle">{asset.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-fg-subtle">
          <span className="font-mono">
            {asset.itemCount} {asset.kind === "scenario" ? (asset.itemCount === 1 ? "mapa" : "mapas") : category?.unit}
          </span>
          <span>atualizado {formatRelative(asset.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}
