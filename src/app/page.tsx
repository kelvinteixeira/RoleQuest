import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { LegalFooter } from "@/components/layout/legal-footer";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <div className="bg-tabletop-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <Link href="/login" className="text-sm text-fg-muted hover:text-fg">Entrar</Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">Onde campanhas viram séries.</h1>
        <p className="mt-5 max-w-xl text-fg-muted">
          Mesa virtual, fichas para os principais sistemas de RPG e o Chronicles Studio para transformar suas sessões em episódios.
        </p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/register" size="lg" trailingIcon={<ArrowRight className="size-4" />}>Começar agora</ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">Já tenho conta</ButtonLink>
        </div>
      </main>
      <LegalFooter className="relative pb-6" />
    </div>
  );
}
