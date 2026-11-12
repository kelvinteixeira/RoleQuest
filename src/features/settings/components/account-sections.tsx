"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Download, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ResourceBar } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { appConfig } from "@/config/app";
import { planById, type BillingStatus } from "@/config/plans";
import { useAsync } from "@/hooks/use-async";
import { formatDate } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { accountService } from "@/services/account.service";
import { toast } from "@/stores/toast.store";
import { useAuth, useCurrentUser } from "@/features/authentication/hooks/use-auth";

const USE_LABEL = { script: "Roteiros", image: "Quadros", voice: "Narrações" } as const;

/** Plan, what was used today, credits, and the way to upgrade or manage the subscription. */
export function BillingSection() {
  const user = useCurrentUser();
  const params = useSearchParams();
  const { data, reload } = useAsync<BillingStatus>(() => accountService.billing(), [user.id]);
  const [busy, setBusy] = useState(false);

  // Back from Stripe: the webhook may take a moment; read the plan again.
  const returned = params.get("billing");
  useEffect(() => {
    if (!returned) return;
    toast.success(returned === "credits" ? "Créditos a caminho" : "Assinatura recebida", "Pode levar alguns segundos para aparecer aqui.");
    const t = setTimeout(() => void reload(), 4000);
    return () => clearTimeout(t);
  }, [returned, reload]);

  async function portal() {
    setBusy(true);
    try {
      window.location.assign(await accountService.portal());
    } catch (error) {
      toast.error("Não deu para abrir a assinatura", toUserMessage(error));
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-fg-subtle">Carregando plano…</p>;
  const plan = planById(data.plan);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-xl font-semibold">{plan.name}</p>
        {data.status && data.status !== "active" && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{data.status === "past_due" ? "Pagamento pendente" : data.status}</span>}
        {data.renewsAt && (
          <span className="text-sm text-fg-subtle">
            {data.cancelAtPeriodEnd ? "Termina em" : "Renova em"} {formatDate(data.renewsAt)}
          </span>
        )}
      </div>
      {!data.enforced && (
        <p className="text-sm text-fg-muted">
          {appConfig.dataSource === "mock" ? "Modo local: tudo liberado, sem cobrança." : "Cobrança ainda não ligada nesta instalação: todos usam os limites do plano Mestre."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(USE_LABEL) as (keyof typeof USE_LABEL)[]).map((k) => (
          <ResourceBar key={k} label={`${USE_LABEL[k]} hoje`} value={data.usedToday[k] ?? 0} max={plan.daily[k]} color="var(--color-accent-solid)" />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-sm text-fg-muted">
        <Sparkles className="size-4 text-accent" /> {data.credits} créditos de IA
      </p>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/plans" size="sm" leadingIcon={<CreditCard className="size-3.5" />}>
          {data.plan === "free" ? "Ver planos" : "Planos e créditos"}
        </ButtonLink>
        {data.status && (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void portal()} leadingIcon={<ExternalLink className="size-3.5" />}>
            Gerenciar assinatura
          </Button>
        )}
      </div>
    </div>
  );
}

/** LGPD: e-mail reminders, a copy of the data and deleting the account. */
export function PrivacySection() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const reminders = useAsync(() => accountService.emailReminders(user), [user.id]);
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const blob = await accountService.exportData(user);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `role-quest-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Não deu para exportar", toUserMessage(error));
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await accountService.remove(user);
      toast.info("Conta excluída", "Seus dados foram apagados. Até a próxima aventura.");
      await signOut();
    } catch (error) {
      toast.error("Não deu para excluir a conta", toUserMessage(error));
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Switch
        checked={reminders.data ?? true}
        disabled={reminders.data === undefined}
        onChange={async (on) => {
          try {
            await accountService.setEmailReminders(user, on);
            await reminders.reload();
          } catch (error) {
            toast.error("Não deu para salvar", toUserMessage(error));
          }
        }}
        label="Lembretes de sessão por e-mail"
        description="Um dia antes de cada sessão das suas campanhas."
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={exporting} onClick={() => void exportData()} leadingIcon={<Download className="size-3.5" />}>
          Exportar meus dados
        </Button>
        <Button size="sm" variant="danger" onClick={() => setConfirm(true)} leadingIcon={<Trash2 className="size-3.5" />}>
          Excluir conta
        </Button>
      </div>
      <p className="text-xs text-fg-subtle">
        O arquivo traz seu perfil, campanhas, sessões, personagens, sistemas e o diário das campanhas que você criou. Veja a <a href="/privacy" className="text-accent hover:underline">política de privacidade</a>.
      </p>

      <Modal
        open={confirm}
        onClose={() => !deleting && setConfirm(false)}
        title="Excluir sua conta?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} disabled={typed.trim().toUpperCase() !== "EXCLUIR"} onClick={() => void remove()}>
              Excluir para sempre
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-fg-muted">
          <p>Isso apaga sua conta, as campanhas que você criou (com mapas, episódios e arquivos), seus personagens e sistemas. Não dá para desfazer.</p>
          <p>Uma assinatura ativa é cancelada. Se quiser guardar algo, exporte seus dados antes.</p>
          <Input label='Digite "EXCLUIR" para confirmar' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </div>
  );
}
