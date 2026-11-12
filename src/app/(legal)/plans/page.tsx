import type { Metadata } from "next";
import { PlansView } from "@/features/billing/components/plans-view";

export const metadata: Metadata = { title: "Planos" };

export default function PlansPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Planos</h1>
        <p className="mx-auto mt-2 max-w-xl text-fg-muted">Jogadores entram de graça pelo convite. Quem conduz a mesa escolhe o plano.</p>
      </div>
      <PlansView />
    </div>
  );
}
