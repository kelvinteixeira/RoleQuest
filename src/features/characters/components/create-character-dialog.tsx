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

/** Name, concept, system and (optionally) campaign; the sheet starts from the system template. */
export function CreateCharacterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const router = useRouter();
  const options = useAsync(
    async () => {
      const [systems, campaigns] = await Promise.all([systemService.listForUser(user.id), characterService.campaignsForNewCharacter(user)]);
      return { systems, campaigns };
    },
    [user.id],
  );
  const [draft, setDraft] = useState<CharacterDraft>({ name: "", concept: "", systemId: "dnd5e", campaignId: null, level: 1, portraitColor: AVATAR_COLORS[4] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const patch = (p: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...p }));

  const campaigns = options.data?.campaigns ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validateCharacterDraft(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      const character = await characterService.create(draft, user);
      toast.success("Personagem criado", character.name);
      onClose();
      router.push(`/characters/${character.id}`);
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
      title="Novo personagem"
      description="A ficha começa com o modelo do sistema e pode ser personalizada depois."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-character" loading={pending}>
            Criar e abrir ficha
          </Button>
        </>
      }
    >
      <form id="create-character" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Nome" autoFocus value={draft.name} onChange={(e) => patch({ name: e.target.value })} error={errors.name} />
        <Input label="Conceito" optional placeholder="Ex.: Anã, clériga da forja" value={draft.concept} onChange={(e) => patch({ concept: e.target.value })} error={errors.concept} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Campanha"
            value={draft.campaignId ?? ""}
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
    </Modal>
  );
}
