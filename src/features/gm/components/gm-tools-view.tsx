"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, DoorOpen, Sparkles, Swords, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { campaignService, type CampaignOverview } from "@/services/campaign.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { useGmTools } from "../hooks/use-gm-tools";
import { settingFor } from "../model/generators";
import { partyOf } from "../model/party";
import { EncounterEditor } from "./encounter-editor";
import { GeneratorsPanel } from "./generators-panel";
import { NpcEditor } from "./npc-editor";

type Tab = "npcs" | "encounters" | "generators";

export function GmToolsView({ campaignId }: { campaignId: string }) {
  const user = useCurrentUser();
  const overview = useAsync(() => campaignService.getOverview(campaignId, user.id), [campaignId, user.id]);

  if (overview.status === "error" && !overview.data) {
    return (
      <PageContainer>
        <ErrorState error={overview.error} onRetry={overview.reload} />
      </PageContainer>
    );
  }
  if (!overview.data) return <LoadingState label="Abrindo as ferramentas do mestre…" />;
  if (overview.data.role !== "game_master") {
    return (
      <PageContainer>
        <ErrorState error={new Error("Só o mestre da campanha usa as ferramentas do mestre.")} />
      </PageContainer>
    );
  }
  return <Tools overview={overview.data} />;
}

function Tools({ overview }: { overview: CampaignOverview }) {
  const campaignId = overview.campaign.id;
  const tools = useGmTools(campaignId);
  const [tab, setTab] = useState<Tab>("npcs");
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);

  // Unsaved NPC/encounter edits: ask before switching away (or leaving the page).
  const dirty = useRef(false);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const guard = useCallback((go: () => void) => {
    if (dirty.current && !window.confirm("Há alterações não salvas. Descartar?")) return;
    dirty.current = false;
    go();
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <PageContainer>
      <Link href={`/campaign/${campaignId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-4" /> {overview.campaign.name}
      </Link>
      <PageHeader
        eyebrow="Ferramentas do mestre"
        title="Preparação"
        description="NPCs com segredos, encontros prontos para a mesa e geradores para improvisar. Os jogadores não veem nada daqui até você revelar."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/campaign/${campaignId}/journal`} variant="secondary" leadingIcon={<BookOpen className="size-4" />}>
              Diário
            </ButtonLink>
            <ButtonLink href={`/campaign/${campaignId}/session`} leadingIcon={<DoorOpen className="size-4" />}>
              Abrir a mesa
            </ButtonLink>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => t !== tab && guard(() => setTab(t))}
        className="mb-5"
        items={[
          { value: "npcs", label: <Label icon={<Users className="size-4" />} text="NPCs" />, count: tools.npcs.length },
          { value: "encounters", label: <Label icon={<Swords className="size-4" />} text="Encontros" />, count: tools.encounters.length },
          { value: "generators", label: <Label icon={<Sparkles className="size-4" />} text="Geradores" /> },
        ]}
      />
      {tools.error && !tools.npcs.length ? (
        <ErrorState error={tools.error} onRetry={tools.reload} />
      ) : tools.loading ? (
        <LoadingState label="Carregando…" />
      ) : tab === "npcs" ? (
        <NpcEditor campaignId={campaignId} tools={tools} selectedId={selectedNpc} onSelect={setSelectedNpc} guard={guard} onDirty={onDirty} />
      ) : tab === "encounters" ? (
        <EncounterEditor tools={tools} party={partyOf(overview)} guard={guard} onDirty={onDirty} />
      ) : (
        <GeneratorsPanel
          campaignId={campaignId}
          initialSetting={settingFor(overview.system.genres)}
          tools={tools}
          onNpcSaved={(id) => {
            setSelectedNpc(id);
            setTab("npcs");
          }}
        />
      )}
    </PageContainer>
  );
}

function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}
