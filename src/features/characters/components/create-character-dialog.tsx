"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { AVATAR_COLORS } from "@/constants/campaign";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/cn";
import { fieldErrorsOf, toUserMessage } from "@/lib/errors";
import { characterService, validateCharacterDraft, type CharacterDraft } from "@/services/character.service";
import { systemService } from "@/services/system.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import type { SystemId } from "@/types/system";
import { buildSheet, conceptOf, isDnd } from "@/features/systems/dnd5e/rules";
import { choicesOf, DND_STEPS, DndCreator, initialCreator, stepProblem, type CreatorState } from "./dnd-creator";

/**
 * Name, concept, system and (optionally) campaign; the sheet starts from the system template.
 * `campaign`: created for that campaign (its system), e.g. from the game room.
 * `onCreated`: stay where the dialog was opened instead of opening the sheet page.
 */
export function CreateCharacterDialog({
  open,
  onClose,
  campaign: fixedCampaign,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  campaign?: { id: string; name: string; systemId: SystemId };
  onCreated?: (character: { id: string; name: string }) => void;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const options = useAsync(
    async () => {
      const [systems, campaigns] = await Promise.all([systemService.listForUser(user.id), characterService.campaignsForNewCharacter(user)]);
      return { systems, campaigns };
    },
    [user.id],
  );
  const [draft, setDraft] = useState<CharacterDraft>({
    name: "",
    concept: "",
    systemId: fixedCampaign?.systemId ?? "dnd5e",
    campaignId: fixedCampaign?.id ?? null,
    level: 1,
    portraitColor: AVATAR_COLORS[4],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  // D&D 5e gets a guided creation (race, class, scores, skills, equipment) after the basics: step 0.
  const [step, setStep] = useState(0);
  const [creator, setCreator] = useState<CreatorState>(initialCreator);
  const patch = (p: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...p }));

  const listed = options.data?.campaigns ?? [];
  const campaigns = fixedCampaign && !listed.some((c) => c.id === fixedCampaign.id) ? [...listed, fixedCampaign] : listed;

  const system = options.data?.systems.find((s) => s.id === draft.systemId);
  const guided = !!system && isDnd(system);
  const lastStep = guided ? DND_STEPS.length : 0;
  const problem = step > 0 ? stepProblem(step - 1, creator) : null;

  async function onSubmit(e: FormEvent, skipGuide = false) {
    e.preventDefault();
    const fieldErrors = validateCharacterDraft(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return setStep(0);
    if (!skipGuide && step < lastStep) {
      if (problem) return void toast.info(problem);
      return setStep(step + 1);
    }
    const useGuide = guided && !skipGuide && !!system;
    setPending(true);
    try {
      const choices = choicesOf(creator);
      const character = await characterService.create(useGuide && !draft.concept.trim() ? { ...draft, concept: conceptOf(choices) } : draft, user);
      if (useGuide) await characterService.save(character.id, { sheet: buildSheet(system, choices, Math.max(1, draft.level ?? 1)) }, user);
      toast.success("Personagem criado", character.name);
      onClose();
      if (onCreated) onCreated(character);
      else router.push(`/characters/${character.id}`);
    } catch (err) {
      setErrors(fieldErrorsOf(err));
      toast.error("Não foi possível criar", toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={step > 0 ? "lg" : "md"}
      title={step > 0 ? `${DND_STEPS[step - 1]} · ${draft.name.trim() || "Novo personagem"}` : "Novo personagem"}
      description={
        step > 0
          ? `Passo ${step} de ${lastStep} · D&D 5e (SRD 5.1)`
          : guided
            ? "Depois do básico, um guia monta a ficha de D&D: raça, classe, atributos, perícias e equipamento."
            : "A ficha começa com o modelo do sistema e pode ser personalizada depois."
      }
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          {step === 0 && guided && (
            <Button variant="secondary" loading={pending} onClick={(e) => void onSubmit(e, true)} title="Cria a ficha em branco do sistema">
              Sem o guia
            </Button>
          )}
          <Button type="submit" form="create-character" loading={pending} disabled={!!problem}>
            {step < lastStep ? "Próximo" : onCreated ? "Criar personagem" : "Criar e abrir ficha"}
          </Button>
        </>
      }
    >
      {step > 0 && system ? (
        <form id="create-character" onSubmit={onSubmit} noValidate>
          <div className="mb-4 flex gap-1" aria-hidden>
            {DND_STEPS.map((label, i) => (
              <span key={label} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-accent" : "bg-line")} />
            ))}
          </div>
          <DndCreator system={system} step={step - 1} state={creator} onChange={setCreator} level={Math.max(1, draft.level ?? 1)} />
          {problem && <p className="mt-3 text-xs text-fg-subtle">{problem}</p>}
        </form>
      ) : (
        <form id="create-character" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input label="Nome" autoFocus value={draft.name} onChange={(e) => patch({ name: e.target.value })} error={errors.name} />
          <Input label="Conceito" optional placeholder="Ex.: Anã, clériga da forja" value={draft.concept} onChange={(e) => patch({ concept: e.target.value })} error={errors.concept} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Campanha"
              value={draft.campaignId ?? ""}
              disabled={!!fixedCampaign}
              onChange={(e) => {
                const campaign = campaigns.find((c) => c.id === e.target.value);
                patch({ campaignId: campaign?.id ?? null, ...(campaign ? { systemId: campaign.systemId } : {}) });
              }}
            >
              <option value="">Nenhuma (biblioteca)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Sistema"
              value={draft.systemId}
              disabled={!!draft.campaignId}
              onChange={(e) => patch({ systemId: e.target.value as SystemId })}
              error={errors.systemId}
              hint={draft.campaignId ? "Definido pela campanha." : undefined}
            >
              {(options.data?.systems ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-4">
            <Input
              label="Nível inicial"
              type="number"
              min={0}
              max={99}
              value={draft.level ?? 0}
              onChange={(e) => patch({ level: Number(e.target.value) })}
              error={errors.level}
              containerClassName="w-32"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Cor do retrato</span>
              <div className="flex gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => patch({ portraitColor: c })}
                    className={cn("flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface", draft.portraitColor === c && "ring-2 ring-fg/70")}
                    style={{ background: c }}
                  >
                    {draft.portraitColor === c && <Check className="size-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
