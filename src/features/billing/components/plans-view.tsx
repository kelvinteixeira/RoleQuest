"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, CREDIT_PACKS, PLANS, type PlanId } from "@/config/plans";
import { cn } from "@/lib/cn";
import { toUserMessage } from "@/lib/errors";
import { accountService } from "@/services/account.service";
import { toast } from "@/stores/toast.store";
import { useAuth } from "@/features/authentication/hooks/use-auth";

/** Plans and credit packs; buying needs an account (sign-up comes back here). */
export function PlansView({ current }: { current?: PlanId }) {
  const { status } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function go(key: string, start: () => Promise<string>) {
    if (status === "loading") return;
    if (status !== "authenticated") return router.push(`/register?next=${encodeURIComponent("/plans")}`);
    setBusy(key);
    try {
      window.location.assign(await start());
    } catch (error) {
      toast.error("Não deu para abrir o pagamento", toUserMessage(error));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = current === plan.id;
          const highlight = plan.id === "mestre";
          return (
            <section key={plan.id} className={cn("surface-card flex flex-col gap-4 p-5", highlight && "ring-1 ring-accent/60")} aria-labelledby={`plano-${plan.id}`}>
              <div>
                <h2 id={`plano-${plan.id}`} className="flex items-center gap-2 font-display text-xl font-semibold">
                  {plan.name}
                  {highlight && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Mais escolhido</span>}
                </h2>
                <p className="mt-1 text-sm text-fg-muted">{plan.tagline}</p>
              </div>
              <p className="font-display text-3xl font-semibold">
                {plan.priceMonthly ? brl(plan.priceMonthly) : "R$ 0"}
                {plan.priceMonthly > 0 && <span className="text-sm font-normal text-fg-subtle"> /mês</span>}
              </p>
              <ul className="flex flex-1 flex-col gap-2 text-sm text-fg-muted">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <Button variant="secondary" disabled={isCurrent || status === "authenticated"} onClick={() => router.push("/register")}>
                  {isCurrent ? "Seu plano" : status === "authenticated" ? "Incluído na conta" : "Criar conta grátis"}
                </Button>
              ) : (
                <Button variant={highlight ? "primary" : "secondary"} disabled={isCurrent} loading={busy === plan.id} onClick={() => void go(plan.id, () => accountService.checkoutPlan(plan.id as "mestre" | "mesa"))}>
                  {isCurrent ? "Seu plano" : `Assinar ${plan.name}`}
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <section aria-labelledby="creditos" className="surface-card p-5">
        <h2 id="creditos" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-4 text-accent" /> Créditos de IA
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Para quando o limite diário do Chronicles acabar: cada roteiro usa 5 créditos; cada quadro ou narração, 1. Não expiram.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => (
            <Button key={pack.id} variant="secondary" loading={busy === pack.id} onClick={() => void go(pack.id, () => accountService.checkoutCredits(pack.id))}>
              {pack.credits} créditos · {brl(pack.price)}
            </Button>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-fg-subtle">
        Pagamento por cartão ou Pix, processado pelo Stripe. Cancele quando quiser; 7 dias para desistir de qualquer compra.
      </p>
    </div>
  );
}
