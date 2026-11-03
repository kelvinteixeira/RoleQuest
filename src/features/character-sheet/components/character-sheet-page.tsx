"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageContainer } from "@/components/layout/page-header";
import { toUserMessage } from "@/lib/errors";
import { characterService } from "@/services/character.service";
import { toast } from "@/stores/toast.store";
import { useCurrentUser } from "@/features/authentication/hooks/use-auth";
import { SheetEditor } from "./sheet-editor";

export function CharacterSheetPage({ characterId }: { characterId: string }) {
  const user = useCurrentUser();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const copy = await characterService.duplicate(characterId, user);
      toast.success("Personagem duplicado", copy.name);
      router.push(`/characters/${copy.id}`);
    } catch (e) {
      toast.error("Não foi possível duplicar", toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await characterService.remove(characterId, user);
      toast.info("Personagem excluído");
      router.replace("/characters");
    } catch (e) {
      toast.error("Não foi possível excluir", toUserMessage(e));
      setBusy(false);
    }
  }

  return (
    <PageContainer className="max-w-6xl">
      <Link href="/characters" className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-4" /> Personagens
      </Link>
      <SheetEditor
        characterId={characterId}
        actions={(data) =>
          data.isOwner && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" loading={busy} leadingIcon={<Copy className="size-3.5" />} onClick={() => void duplicate()}>
                Duplicar
              </Button>
              <Button variant="danger" size="sm" disabled={busy} leadingIcon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            </div>
          )
        }
      />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir personagem?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">A ficha será apagada e o personagem sai da campanha em que estiver. Isso não pode ser desfeito.</p>
      </Modal>
    </PageContainer>
  );
}
