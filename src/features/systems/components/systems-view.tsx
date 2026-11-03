"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Wand2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, PhaseBadge, SectionHeader } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/feedback/states";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { systemService } from "@/services/system.service";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { SystemTemplate } from "@/types/system";
import { coverGradient, SystemEmblem, systemStyle } from "./system-identity";
import { SystemDetail } from "./system-detail";

export function SystemsView() {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, status, error, reload } = useAsync(() => systemService.listForUser(user.id), [user.id]);

  const selectedId = params.get("system");
  const selected = data?.find((s) => s.id === selectedId) ?? null;
  const [creating, setCreating] = useState(params.get("create") === "1");

  const open = (id: string) => router.replace(`${pathname}?system=${id}`, { scroll: false });
  const close = () => router.replace(pathname, { scroll: false });

  const builtIn = data?.filter((s) => s.kind === "builtin") ?? systemService.listBuiltIn();
  const custom = data?.filter((s) => s.kind === "custom") ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Sistemas de RPG"
        description="Modelos estruturais com ficha, dados, recursos, combate e regras configuráveis. Nenhum conteúdo de livro é reproduzido."
        actions={
          <Button variant="secondary" leadingIcon={<Wand2 className="size-4" />} onClick={() => setCreating(true)}>
            Criar meu próprio sistema
          </Button>
        }
      />

      {status === "error" && <ErrorState error={error} onRetry={reload} className="mb-6" />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {builtIn.map((system) => (
          <SystemCard key={system.id} system={system} onOpen={() => open(system.id)} />
        ))}
      </div>

      <section className="mt-12">
        <SectionHeader title="Seus sistemas" description="Sistemas criados por você para suas campanhas." />
        {custom.length === 0 ? (
          <button
            onClick={() => setCreating(true)}
            className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center text-fg-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            <Plus className="size-5" />
            <span className="text-sm font-medium">Criar meu próprio sistema</span>
            <span className="text-xs text-fg-subtle">Atributos, dados, recursos e regras do seu jeito.</span>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {custom.map((system) => (
              <SystemCard key={system.id} system={system} onOpen={() => open(system.id)} />
            ))}
          </div>
        )}
      </section>

      <Modal open={!!selected} onClose={close} title={selected?.name ?? ""} placement="right">
        {selected && <SystemDetail system={selected} />}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Criar meu próprio sistema" size="md">
        <div className="flex flex-col gap-4 text-sm text-fg-muted">
          <p>
            Você já pode criar um sistema próprio ao montar uma campanha: escolha <strong className="text-fg">Sistema próprio</strong> na etapa de
            sistema e defina nome, temática e dado principal. Ele fica salvo aqui, com ficha inicial de três atributos, vida e energia.
          </p>
          <div className="rounded-lg border border-line bg-surface-2/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fg">Editor completo de sistemas</span>
              <PhaseBadge phase={2} />
            </div>
            <p className="mt-1 text-xs text-fg-subtle">
              Atributos, perícias, classes, raças, habilidades, fórmulas de rolagem, recursos, inventário, regras de combate, progressão e campos personalizados.
            </p>
          </div>
          <ButtonLink href="/campaigns/new?system=custom" leadingIcon={<Plus className="size-4" />} className="self-start">
            Criar campanha com sistema próprio
          </ButtonLink>
        </div>
      </Modal>
    </PageContainer>
  );
}

function SystemCard({ system, onOpen }: { system: SystemTemplate; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={systemStyle(system.theme)}
      className="group surface-card flex flex-col overflow-hidden text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-system/40"
    >
      <div className="relative h-20" style={{ background: coverGradient(system.theme.gradient) }}>
        <div className="bg-tabletop-grid absolute inset-0 opacity-50" />
        <SystemEmblem theme={system.theme} size="md" className="absolute bottom-0 left-4 translate-y-1/2 bg-surface" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-7">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-system">{system.name}</h3>
          {system.kind === "custom" && <Badge tone="accent">Seu</Badge>}
        </div>
        <p className="text-sm text-fg-subtle">{system.tagline}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-system">{system.dice.defaultFormula}</code>
          {system.genres.slice(0, 2).map((g) => (
            <span key={g} className="text-[11px] text-fg-subtle">
              · {g}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
