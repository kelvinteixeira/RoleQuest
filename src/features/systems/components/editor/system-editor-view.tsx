"use client";

import { useRef, useState } from "react";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/feedback/states";
import { PageContainer } from "@/components/layout/page-header";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { systemService } from "@/services/system.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { SystemId, SystemTemplate } from "@/types/system";
import { pruneReferences, validateSystem } from "../../model/system-editor";
import { coverGradient, SystemEmblem, systemStyle } from "../system-identity";
import {
  AttributesSection,
  ClassesSection,
  CombatInventorySection,
  ConditionsSection,
  CustomFieldsSection,
  DiceSection,
  IdentitySection,
  ProgressionSection,
  ResourcesSection,
  SkillsSection,
  type EditorSectionProps,
} from "./system-editor-sections";

const SECTIONS: { id: string; title: string; description: string; prefix: string[]; Component: React.ComponentType<EditorSectionProps> }[] = [
  { id: "identidade", title: "Identidade", description: "Nome, apresentação e visual.", prefix: ["name", "shortName"], Component: IdentitySection },
  { id: "dados", title: "Dados e testes", description: "Como os testes são rolados.", prefix: ["dice"], Component: DiceSection },
  { id: "atributos", title: "Atributos", description: "As características básicas de todo personagem.", prefix: ["attributes"], Component: AttributesSection },
  { id: "recursos", title: "Recursos", description: "Vida, energia, sanidade… com barra na ficha e no token.", prefix: ["resources"], Component: ResourcesSection },
  { id: "pericias", title: "Perícias", description: "O que os personagens podem treinar.", prefix: ["skills"], Component: SkillsSection },
  { id: "classes", title: "Classes", description: "Pacotes de bônus, perícias e habilidades iniciais.", prefix: ["classes"], Component: ClassesSection },
  { id: "progressao", title: "Progressão", description: "Como os personagens evoluem.", prefix: ["progression"], Component: ProgressionSection },
  { id: "condicoes", title: "Condições", description: "Estados que a mesa pode aplicar.", prefix: ["conditions"], Component: ConditionsSection },
  { id: "campos", title: "Campos da ficha", description: "Campos extras do seu sistema.", prefix: ["customFields"], Component: CustomFieldsSection },
  { id: "combate", title: "Combate e inventário", description: "Iniciativa, defesa, distâncias e itens.", prefix: ["combat", "inventory"], Component: CombatInventorySection },
];

export function SystemEditorView({ systemId }: { systemId: string }) {
  const user = useCurrentUser();
  const loaded = useAsync(() => systemService.getEditable(systemId as SystemId, user.id), [systemId, user.id]);
  if (loaded.status === "error" && !loaded.data) {
    return (
      <PageContainer>
        <BackLink />
        <ErrorState error={loaded.error} onRetry={loaded.reload} />
      </PageContainer>
    );
  }
  if (!loaded.data) return <LoadingState label="Abrindo o editor…" />;
  return <Editor key={loaded.data.id} initial={loaded.data} userId={user.id} />;
}

function BackLink() {
  return (
    <Link href="/systems" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
      <ArrowLeft className="size-4" /> Sistemas
    </Link>
  );
}

function Editor({ initial, userId }: { initial: SystemTemplate; userId: string }) {
  const [system, setSystem] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bumped on every edit: a save only clears "dirty" if nothing was typed while it ran.
  const revision = useRef(0);
  // Removed attributes/skills/resources drop their references right away, so the form never shows dangling links.
  const set = (patch: Partial<SystemTemplate>) => {
    revision.current += 1;
    setDirty(true);
    setSystem((s) => pruneReferences({ ...s, ...patch }));
  };
  const errors = validateSystem(system);
  const errorCount = Object.keys(errors).length;
  const sectionHasError = (prefix: string[]) => Object.keys(errors).some((k) => prefix.some((p) => k === p || k.startsWith(`${p}.`)));

  useUnsavedGuard(dirty);

  async function save() {
    setSaving(true);
    const started = revision.current;
    try {
      const saved = await systemService.saveCustom(userId, system);
      // Edits made during the save stay in the form (and stay unsaved).
      if (revision.current === started) {
        setSystem(saved);
        setDirty(false);
      }
      toast.success("Sistema salvo", "Fichas e campanhas que usam este sistema já veem as mudanças.");
    } catch (e) {
      toast.error("Não foi possível salvar", toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={systemStyle(system.theme)}>
      <div className="relative h-28" style={{ background: coverGradient(system.theme.gradient) }}>
        <div className="bg-tabletop-grid absolute inset-0 opacity-50" />
      </div>
      <PageContainer className="pt-0 lg:pt-0">
        <div className="-mt-8 mb-6 flex flex-wrap items-end gap-4">
          <SystemEmblem theme={system.theme} size="lg" className="bg-surface" />
          <div className="min-w-0 flex-1">
            <BackLink />
            <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{system.name || "Sem nome"}</h1>
            <p className="text-sm text-fg-subtle">Editor de sistema · as mudanças valem para todas as campanhas que o usam</p>
          </div>
        </div>

        <div className="sticky top-14 z-20 -mx-4 mb-5 border-y border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:-mx-10 lg:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <p className={cn("min-w-0 flex-1 truncate text-sm", errorCount ? "text-danger" : "text-fg-subtle")} role="status" aria-live="polite" aria-atomic="true">
              {errorCount ? `${errorCount} problema(s): ${Object.values(errors)[0]}` : dirty ? "Alterações não salvas." : "Tudo salvo."}
            </p>
            <Button onClick={() => void save()} loading={saving} disabled={!dirty || errorCount > 0} leadingIcon={<Save className="size-4" />}>
              Salvar sistema
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Seções do sistema" className="hidden lg:block">
            <ul className="sticky top-24 flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg">
                    {s.title}
                    {sectionHasError(s.prefix) && (
                      <>
                        <span className="size-2 rounded-full bg-danger" aria-hidden />
                        <span className="sr-only">(com erro)</span>
                      </>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-5">
            {SECTIONS.map((s) => (
              <Card key={s.id} id={s.id} className="scroll-mt-24 p-5">
                <h2 className="font-display text-lg font-semibold">{s.title}</h2>
                <p className="mb-4 text-sm text-fg-subtle">{s.description}</p>
                <s.Component system={system} errors={errors} set={set} />
              </Card>
            ))}
          </div>
        </div>
      </PageContainer>

    </div>
  );
}
