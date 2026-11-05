"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Compass, Feather, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/cn";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { campaignService, validateCreateCampaign } from "@/services/campaign.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { getBuiltInSystem } from "@/features/systems/templates";
import { SystemTag } from "@/features/systems/components/system-identity";
import { CoverArt } from "../components/campaign-card";
import { createInitialDraft, firstStepWithError, STEPS, toCommand, toScratchCommand, validateStep, type CampaignDraft } from "./wizard-model";
import { useWizardStore } from "./wizard.store";
import { MasterStep, NameStep, PlayersStep, SessionStep, StyleStep, SystemStep, WorldStep } from "./wizard-steps";
import type { SystemTheme } from "@/types/system";

const CUSTOM_THEME: SystemTheme = {
  accent: "oklch(0.7 0.2 302)",
  glyph: "sparkles",
  gradient: ["oklch(0.3 0.1 300)", "oklch(0.15 0.02 300)"],
};

function draftSystem(draft: CampaignDraft): { name: string; shortName: string; theme: SystemTheme } {
  if (draft.systemMode === "custom") {
    const name = draft.custom.name.trim() || "Sistema próprio";
    return { name, shortName: name.slice(0, 14), theme: CUSTOM_THEME };
  }
  const s = getBuiltInSystem(draft.builtinId);
  return { name: s.name, shortName: s.shortName, theme: s.theme };
}

export function CampaignWizard() {
  const user = useCurrentUser();
  const params = useSearchParams();
  const { draft, mode, start, setMode } = useWizardStore();

  // Open (or keep) the draft. `?system=custom` comes from the Systems page.
  useEffect(() => {
    const wantsCustom = params.get("system") === "custom";
    const current = useWizardStore.getState();
    if (!current.draft) {
      const fresh = createInitialDraft(user);
      start(wantsCustom ? { ...fresh, systemMode: "custom" } : fresh, wantsCustom ? "guided" : "choose");
    } else if (wantsCustom && current.draft.systemMode !== "custom") {
      current.update("systemMode", "custom");
    }
  }, [params, user, start]);

  if (!draft) return null;

  return (
    <PageContainer className="max-w-6xl">
      {mode === "choose" && <ModeChooser onChoose={setMode} />}
      {mode === "scratch" && <ScratchForm onBack={() => setMode("choose")} />}
      {mode === "guided" && <GuidedWizard draft={draft} />}
    </PageContainer>
  );
}

/* ---------- Mode chooser ---------- */

function ModeChooser({ onChoose }: { onChoose: (mode: "guided" | "scratch") => void }) {
  const options = [
    {
      mode: "guided" as const,
      icon: Compass,
      title: "Criação guiada",
      description: "Sete etapas: nome, sistema, estilo visual, mestre, jogadores, mundo e primeira sessão.",
      badge: "Recomendado",
    },
    {
      mode: "scratch" as const,
      icon: Feather,
      title: "Começar do zero",
      description: "Só o nome. A campanha nasce com um sistema em branco e você configura tudo depois.",
    },
  ];
  return (
    <>
      <PageHeader eyebrow="Nova campanha" title="Como você quer começar?" description="Você pode mudar tudo depois. Nada é publicado até você criar a campanha." />
      <div className="grid gap-4 md:grid-cols-2">
        {options.map(({ mode, icon: Icon, title, description, badge }) => (
          <button
            key={mode}
            onClick={() => onChoose(mode)}
            className="group surface-card flex flex-col gap-4 p-6 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <Icon className="size-5" />
              </span>
              {badge && <Badge tone="accent">{badge}</Badge>}
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold group-hover:text-accent">{title}</h2>
              <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted group-hover:text-fg">
              Continuar <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- Scratch ---------- */

function useCreateCampaign() {
  const user = useCurrentUser();
  const router = useRouter();
  const reset = useWizardStore((s) => s.reset);
  const [pending, setPending] = useState(false);

  async function create(command: Parameters<typeof campaignService.create>[0]) {
    setPending(true);
    try {
      const campaign = await campaignService.create(command, user);
      toast.success("Campanha criada", campaign.name);
      router.push(`/campaign/${campaign.id}`);
      reset();
    } catch (error) {
      setPending(false);
      throw error;
    }
  }
  return { create, pending };
}

function ScratchForm({ onBack }: { onBack: () => void }) {
  const user = useCurrentUser();
  const { create, pending } = useCreateCampaign();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const command = toScratchCommand(name, user);
    const errors = validateCreateCampaign(command);
    if (errors.name) return setError(errors.name);
    try {
      await create(command);
    } catch (err) {
      setError(fieldErrorsOf(err).name ?? toUserMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackButton onClick={onBack} />
      <PageHeader eyebrow="Começar do zero" title="Dê um nome à campanha" description="Ela começa em preparação, com um sistema próprio em branco. Sistema, mundo e jogadores podem ser definidos depois." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nome da campanha"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={error}
          className="h-12 font-display text-lg"
        />
        <Button type="submit" size="lg" loading={pending} leadingIcon={<Sparkles className="size-4" />} className="self-start">
          Criar campanha
        </Button>
      </form>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
      <ArrowLeft className="size-4" /> Trocar forma de começar
    </button>
  );
}

/* ---------- Guided ---------- */

function GuidedWizard({ draft }: { draft: CampaignDraft }) {
  const { step, maxVisited, errors, update, goTo, setErrors, setMode, reset } = useWizardStore();
  const user = useCurrentUser();
  const { create, pending } = useCreateCampaign();
  const [direction, setDirection] = useState(1);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const system = draftSystem(draft);

  function move(to: number) {
    setDirection(to > step ? 1 : -1);
    goTo(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const stepErrors = validateStep(draft, step);
    if (Object.keys(stepErrors).length > 0) return setErrors(stepErrors);
    if (!isLast) return move(step + 1);

    const all = validateCreateCampaign(toCommand(draft));
    if (Object.keys(all).length > 0) {
      setErrors(all);
      return move(firstStepWithError(all));
    }
    try {
      await create(toCommand(draft));
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        const target = firstStepWithError(fieldErrors);
        if (target >= 0) move(target);
      }
      toast.error("Não foi possível criar a campanha", toUserMessage(error));
    }
  }

  function discard() {
    reset();
    useWizardStore.getState().start(createInitialDraft(user));
  }

  const stepProps = { draft, errors, update };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setMode("choose")} className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
          <ArrowLeft className="size-4" /> Trocar forma de começar
        </button>
        <Button variant="ghost" size="sm" leadingIcon={<Trash2 className="size-3.5" />} onClick={discard}>
          Descartar rascunho
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        <StepRail step={step} maxVisited={maxVisited} onSelect={move} />

        <form onSubmit={onSubmit} noValidate className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
            Etapa {step + 1} de {STEPS.length}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{current.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{current.description}</p>

          <div className="relative mt-6">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current.id}
                custom={direction}
                initial={{ opacity: 0, x: 24 * direction }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 * direction }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {current.id === "name" && <NameStep {...stepProps} />}
                {current.id === "system" && <SystemStep {...stepProps} />}
                {current.id === "style" && <StyleStep {...stepProps} theme={system.theme} />}
                {current.id === "master" && <MasterStep {...stepProps} />}
                {current.id === "players" && <PlayersStep {...stepProps} />}
                {current.id === "world" && <WorldStep {...stepProps} />}
                {current.id === "session" && <SessionStep {...stepProps} systemName={system.name} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button variant="ghost" disabled={step === 0} onClick={() => move(step - 1)} leadingIcon={<ArrowLeft className="size-4" />}>
              Voltar
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={pending}
              trailingIcon={isLast ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
            >
              {isLast ? "Criar campanha" : "Continuar"}
            </Button>
          </div>
        </form>

        <LivePreview draft={draft} system={system} />
      </div>
    </>
  );
}

function StepRail({ step, maxVisited, onSelect }: { step: number; maxVisited: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="Etapas">
      {/* Mobile: compact progress bar */}
      <div className="flex gap-1 lg:hidden" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.id} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-surface-3")} />
        ))}
      </div>
      <ol className="hidden flex-col gap-1 lg:flex">
        {STEPS.map((s, i) => {
          const reachable = i <= maxVisited;
          const done = i < step || (i <= maxVisited && i !== step && i < maxVisited);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  i === step ? "bg-surface-2 text-fg" : reachable ? "text-fg-muted hover:bg-surface-2/60 hover:text-fg" : "text-fg-subtle/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                    i === step ? "border-accent-solid bg-accent-solid text-accent-fg" : done ? "border-accent/40 text-accent" : "border-line-strong",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function LivePreview({ draft, system }: { draft: CampaignDraft; system: ReturnType<typeof draftSystem> }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Prévia</p>
        <Card className="overflow-hidden">
          <div className="relative">
            <CoverArt visualStyleId={draft.visualStyleId} theme={system.theme} className="h-28" />
            <Badge tone="info" dot className="absolute left-3 top-3 bg-canvas/70 backdrop-blur">
              {draft.scheduleFirstSession ? "Em andamento" : "Em preparação"}
            </Badge>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div>
              <h3 className={cn("font-display text-lg font-semibold leading-snug", !draft.name && "text-fg-subtle")}>{draft.name || "Sua campanha"}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-fg-subtle">{draft.tagline || "A chamada aparece aqui."}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SystemTag theme={system.theme} label={system.shortName} />
              {draft.world.tone.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            <p className="border-t border-line pt-3 text-xs text-fg-subtle">
              {draft.playerPolicy.maxPlayers} vagas · convite por link
            </p>
          </div>
        </Card>
      </div>
    </aside>
  );
}
