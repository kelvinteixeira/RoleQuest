"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useAsync } from "@/hooks/use-async";
import { toUserMessage } from "@/lib/errors";
import { campaignAdminService } from "@/services/campaign-admin.service";
import { toast } from "@/stores/toast.store";
import type { ID } from "@/types/common";

type Actor = { id: ID; displayName: string };

export function inviteUrl(code: string): string {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/join/${code}`;
}

/**
 * The campaign's invite link for the GM: copy it to WhatsApp/Discord, make a
 * new one (links already shared stop working) or turn it off.
 */
export function InviteLinkCard({ campaignId, user, freeSeats }: { campaignId: ID; user: Actor; freeSeats: number }) {
  const link = useAsync(() => campaignAdminService.inviteLink(campaignId, user), [campaignId, user.id]);
  const [busy, setBusy] = useState<"renew" | "off" | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);

  async function act(kind: "renew" | "off") {
    setBusy(kind);
    try {
      if (kind === "renew") await campaignAdminService.renewInviteLink(campaignId, user);
      else await campaignAdminService.disableInviteLink(campaignId, user);
      toast.success(kind === "renew" ? (link.data ? "Novo link criado: o anterior parou de funcionar" : "Link de convite criado") : "Link de convite desativado");
      await link.reload();
    } catch (e) {
      toast.error("Não deu certo", toUserMessage(e));
    } finally {
      setBusy(null);
      setConfirmRenew(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não deu para copiar", "Selecione o link e copie manualmente.");
    }
  }

  const url = link.data ? inviteUrl(link.data.code) : null;

  return (
    <Card>
      <CardHeader
        title="Link de convite"
        icon={<Link2 />}
        description={freeSeats > 0 ? `${freeSeats} vaga(s) livre(s)` : "Sem vagas livres: aumente o limite em Regras da mesa."}
      />
      <div className="flex flex-col gap-3 p-5 pt-3">
        {link.status === "loading" && !link.data ? (
          <p className="text-sm text-fg-subtle">Carregando…</p>
        ) : link.status === "error" ? (
          <p className="text-sm text-danger">{toUserMessage(link.error)}</p>
        ) : url ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                aria-label="Link de convite"
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 font-mono text-xs text-fg-muted"
              />
              <Button size="sm" onClick={() => void copy(url)} leadingIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}>
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-fg-subtle">Mande no grupo da mesa. Quem abrir, com a conta logada, entra como jogador enquanto houver vagas.</p>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {confirmRenew ? (
                <>
                  <Button size="sm" variant="danger" autoFocus loading={busy === "renew"} onClick={() => void act("renew")}>
                    Criar novo link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRenew(false)}>
                    Cancelar
                  </Button>
                  <p className="w-full text-xs text-fg-subtle">O link atual vai parar de funcionar para quem ainda não entrou.</p>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" leadingIcon={<RefreshCw className="size-3.5" />} onClick={() => setConfirmRenew(true)} disabled={busy !== null}>
                    Gerar outro link
                  </Button>
                  <Button size="sm" variant="ghost" leadingIcon={<Unlink className="size-3.5" />} loading={busy === "off"} onClick={() => void act("off")} disabled={busy !== null}>
                    Desativar
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-fg-muted">O link de convite está desativado. Ninguém novo entra até você criar outro.</p>
            <Button size="sm" leadingIcon={<Link2 className="size-3.5" />} loading={busy === "renew"} onClick={() => void act("renew")}>
              Criar link de convite
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
