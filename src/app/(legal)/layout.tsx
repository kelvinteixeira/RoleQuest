import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LegalFooter } from "@/components/layout/legal-footer";

/** Public pages anyone can read: terms, privacy, plans. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="Role Quest — início">
          <Logo />
        </Link>
        <Link href="/login" className="text-sm text-fg-muted hover:text-fg">
          Entrar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-12">{children}</main>
      <LegalFooter className="pb-8" />
    </div>
  );
}
